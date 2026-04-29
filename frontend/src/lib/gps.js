/**
 * GPS Utility Library for MediQueue Smart Queue System
 * Uses Supabase directly — no backend dependency.
 */

import { supabase } from './supabase';

/**
 * Haversine distance formula — calculates great-circle distance between two GPS points.
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in meters
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Request the user's current GPS location.
 * @returns {Promise<{lat: number, lng: number}>}
 */
export function requestLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(new Error('Location permission denied. Please enable GPS access.'));
            break;
          case error.POSITION_UNAVAILABLE:
            reject(new Error('Location information unavailable. Please check your GPS.'));
            break;
          case error.TIMEOUT:
            reject(new Error('Location request timed out. Please try again.'));
            break;
          default:
            reject(new Error('An unknown error occurred while getting location.'));
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  });
}

/**
 * Fetch hospital coordinates from Supabase settings table.
 */
async function getHospitalCoords() {
  const { data, error } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', ['hospital_lat', 'hospital_lng', 'detection_radius']);

  if (error || !data) {
    return { lat: 0, lng: 0, radius: 50 };
  }

  const settings = {};
  data.forEach((row) => { settings[row.key] = row.value; });

  return {
    lat: parseFloat(settings.hospital_lat || '0'),
    lng: parseFloat(settings.hospital_lng || '0'),
    radius: parseFloat(settings.detection_radius || '50'),
  };
}

/**
 * Process a location update for a patient appointment.
 * All logic runs client-side + Supabase — no backend needed.
 */
async function processLocationUpdate(appointmentId, patientLat, patientLng) {
  try {
    // Fetch the appointment
    const { data: appointment, error: apptError } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .single();

    if (apptError || !appointment) {
      return { status: 'error', distance: 0, demoted: false, message: 'Appointment not found.' };
    }

    // Only track waiting appointments
    if (appointment.status !== 'waiting') {
      return { status: 'not_tracking', distance: 0, demoted: false, message: 'Tracking only applies to waiting appointments.' };
    }

    // Get hospital coordinates
    const hospital = await getHospitalCoords();

    if (hospital.lat === 0 && hospital.lng === 0) {
      return { status: 'not_configured', distance: 0, demoted: false, message: 'Hospital location not configured. Contact admin.' };
    }

    // Calculate distance
    const distance = haversineDistance(patientLat, patientLng, hospital.lat, hospital.lng);
    const distanceRounded = Math.round(distance * 10) / 10;

    // Update patient location in appointment
    await supabase
      .from('appointments')
      .update({
        patient_lat: patientLat,
        patient_lng: patientLng,
        location_tracking: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId);

    // Already demoted — just return status
    if (appointment.was_demoted) {
      return {
        status: 'demoted',
        distance: distanceRounded,
        demoted: true,
        old_position: appointment.original_queue_number,
        new_position: appointment.queue_number,
        message: `Your token was previously moved. You are ${distanceRounded}m from the hospital.`,
      };
    }

    // WITHIN range — clear any warning
    if (distance <= hospital.radius) {
      if (appointment.was_warned) {
        await supabase
          .from('appointments')
          .update({ was_warned: false, warned_at: null, updated_at: new Date().toISOString() })
          .eq('id', appointmentId);
      }
      return {
        status: 'within_range',
        distance: distanceRounded,
        demoted: false,
        message: `You are within hospital range (${distanceRounded}m).`,
      };
    }

    // OUTSIDE range — not yet warned
    if (!appointment.was_warned) {
      await supabase
        .from('appointments')
        .update({
          was_warned: true,
          warned_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', appointmentId);

      return {
        status: 'warned',
        distance: distanceRounded,
        demoted: false,
        message: `Warning: You are ${distanceRounded}m away from the hospital. Return within 60 seconds!`,
      };
    }

    // Already warned — check grace period
    if (appointment.warned_at) {
      const warnedTime = new Date(appointment.warned_at);
      const now = new Date();
      const elapsedSeconds = (now - warnedTime) / 1000;

      if (elapsedSeconds < 60) {
        const remaining = Math.max(0, Math.round(60 - elapsedSeconds));
        return {
          status: 'grace_period',
          distance: distanceRounded,
          demoted: false,
          grace_remaining: remaining,
          message: `You are ${distanceRounded}m away! Return within ${remaining} seconds or your token will be moved down.`,
        };
      }

      // Grace period expired — DEMOTE via Supabase RPC
      const { data: demoteResult, error: demoteError } = await supabase
        .rpc('demote_patient_queue', {
          p_appointment_id: appointmentId,
          p_demote_by: 2,
        });

      if (!demoteError && demoteResult && demoteResult.success) {
        return {
          status: 'demoted',
          distance: distanceRounded,
          demoted: true,
          old_position: demoteResult.old_position,
          new_position: demoteResult.new_position,
          message: demoteResult.message || 'Your token has been moved down.',
        };
      } else {
        return {
          status: 'grace_period',
          distance: distanceRounded,
          demoted: false,
          message: (demoteResult && demoteResult.message) || 'Could not demote at this time.',
        };
      }
    }

    return {
      status: 'warned',
      distance: distanceRounded,
      demoted: false,
      message: `Warning: You are ${distanceRounded}m away from the hospital.`,
    };
  } catch (err) {
    console.error('GPS processing error:', err);
    return { status: 'error', distance: 0, demoted: false, message: err.message || 'GPS processing failed.' };
  }
}

/**
 * Start continuous location tracking for a patient's appointment.
 * Uses watchPosition for real-time GPS updates.
 * Processes location every 30 seconds via Supabase directly.
 *
 * @param {string} appointmentId
 * @param {function} onStatusUpdate - Callback receiving location status updates
 * @returns {function} Cleanup function to stop tracking
 */
export function startLocationTracking(appointmentId, onStatusUpdate) {
  let watchId = null;
  let intervalId = null;
  let lastPosition = null;
  let isProcessing = false;

  async function sendUpdate() {
    if (!lastPosition || isProcessing) return;
    isProcessing = true;

    try {
      const result = await processLocationUpdate(
        appointmentId,
        lastPosition.lat,
        lastPosition.lng
      );
      if (onStatusUpdate) {
        onStatusUpdate(result);
      }
    } catch (error) {
      if (onStatusUpdate) {
        onStatusUpdate({
          status: 'error',
          distance: 0,
          demoted: false,
          message: error.message || 'Failed to update location.',
        });
      }
    } finally {
      isProcessing = false;
    }
  }

  // Watch position for real-time GPS updates
  if (navigator.geolocation) {
    watchId = navigator.geolocation.watchPosition(
      (position) => {
        lastPosition = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
      },
      (error) => {
        console.error('GPS watch error:', error);
        if (onStatusUpdate) {
          onStatusUpdate({
            status: 'gps_error',
            distance: 0,
            demoted: false,
            message: 'GPS signal lost. Please ensure location is enabled.',
          });
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 5000,
      }
    );

    // Try to send first update quickly once position is available
    const initialCheck = setInterval(() => {
      if (lastPosition) {
        sendUpdate();
        clearInterval(initialCheck);
      }
    }, 1000);

    // Send location every 30 seconds
    intervalId = setInterval(sendUpdate, 30000);

    // Safety: clear initial check after 30s
    setTimeout(() => clearInterval(initialCheck), 30000);
  }

  // Return cleanup function
  return function cleanup() {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
    }
    if (intervalId !== null) {
      clearInterval(intervalId);
    }
  };
}
