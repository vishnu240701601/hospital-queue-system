/**
 * GPS Utility Library for MediQueue Smart Queue System
 * Uses Supabase directly — high-accuracy, real-time tracking.
 */

import { supabase } from './supabase';

/**
 * Haversine distance formula — great-circle distance between two GPS points.
 * @returns {number} Distance in meters
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Request the user's current GPS location (one-shot).
 */
export function requestLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (error) => {
        const messages = {
          1: 'Location permission denied. Please enable GPS access.',
          2: 'Location information unavailable. Please check your GPS.',
          3: 'Location request timed out. Please try again.',
        };
        reject(new Error(messages[error.code] || 'Unknown GPS error.'));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

/** Cache for hospital coordinates — refreshed every 60s */
let _hospitalCache = null;
let _hospitalCacheTime = 0;

async function getHospitalCoords() {
  const now = Date.now();
  if (_hospitalCache && now - _hospitalCacheTime < 60000) {
    return _hospitalCache;
  }

  const { data } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', ['hospital_lat', 'hospital_lng', 'detection_radius']);

  const s = {};
  (data || []).forEach((r) => { s[r.key] = r.value; });

  _hospitalCache = {
    lat: parseFloat(s.hospital_lat || '0'),
    lng: parseFloat(s.hospital_lng || '0'),
    radius: parseFloat(s.detection_radius || '50'),
  };
  _hospitalCacheTime = now;
  return _hospitalCache;
}

/**
 * Process a single location update against the hospital coordinates.
 * All logic runs client-side + Supabase.
 */
async function processLocationUpdate(appointmentId, patientLat, patientLng) {
  try {
    const { data: appointment, error: apptError } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .single();

    if (apptError || !appointment) {
      return { status: 'error', distance: 0, demoted: false, message: 'Appointment not found.' };
    }

    if (appointment.status !== 'waiting') {
      return { status: 'not_tracking', distance: 0, demoted: false, message: 'Tracking only applies to waiting appointments.' };
    }

    const hospital = await getHospitalCoords();
    if (hospital.lat === 0 && hospital.lng === 0) {
      return { status: 'not_configured', distance: 0, demoted: false, message: 'Hospital location not configured. Contact admin.' };
    }

    const distance = haversineDistance(patientLat, patientLng, hospital.lat, hospital.lng);
    const distanceRounded = Math.round(distance * 10) / 10;

    // Update patient coords silently
    supabase
      .from('appointments')
      .update({ patient_lat: patientLat, patient_lng: patientLng, location_tracking: true, updated_at: new Date().toISOString() })
      .eq('id', appointmentId)
      .then(() => {});

    // Already demoted
    if (appointment.was_demoted) {
      return {
        status: 'demoted', distance: distanceRounded, demoted: true,
        old_position: appointment.original_queue_number,
        new_position: appointment.queue_number,
        message: `Your token was moved. You are ${distanceRounded}m from hospital.`,
      };
    }

    // WITHIN range
    if (distance <= hospital.radius) {
      if (appointment.was_warned) {
        supabase.from('appointments')
          .update({ was_warned: false, warned_at: null, updated_at: new Date().toISOString() })
          .eq('id', appointmentId).then(() => {});
      }
      return {
        status: 'within_range', distance: distanceRounded, demoted: false,
        message: `You are within hospital range (${distanceRounded}m).`,
      };
    }

    // OUTSIDE range — first warning
    if (!appointment.was_warned) {
      const warnedAt = new Date().toISOString();
      await supabase.from('appointments')
        .update({ was_warned: true, warned_at: warnedAt, updated_at: warnedAt })
        .eq('id', appointmentId);

      return {
        status: 'warned', distance: distanceRounded, demoted: false,
        warned_at: warnedAt,
        message: `⚠️ You are ${distanceRounded}m away! Return within 60 seconds!`,
      };
    }

    // Already warned — check grace
    if (appointment.warned_at) {
      const warnedTime = new Date(appointment.warned_at).getTime();
      const elapsed = (Date.now() - warnedTime) / 1000;

      if (elapsed < 60) {
        const remaining = Math.max(0, Math.round(60 - elapsed));
        return {
          status: 'grace_period', distance: distanceRounded, demoted: false,
          grace_remaining: remaining, warned_at: appointment.warned_at,
          message: `🚨 ${distanceRounded}m away! Return in ${remaining}s or token moves down!`,
        };
      }

      // Grace expired — DEMOTE
      const { data: result } = await supabase
        .rpc('demote_patient_queue', { p_appointment_id: appointmentId, p_demote_by: 2 });

      if (result && result.success) {
        return {
          status: 'demoted', distance: distanceRounded, demoted: true,
          old_position: result.old_position, new_position: result.new_position,
          message: result.message || 'Your token has been moved down.',
        };
      }
      return {
        status: 'grace_period', distance: distanceRounded, demoted: false,
        message: (result && result.message) || 'Queue unchanged.',
      };
    }

    return { status: 'warned', distance: distanceRounded, demoted: false, message: `${distanceRounded}m away from hospital.` };
  } catch (err) {
    console.error('GPS error:', err);
    return { status: 'error', distance: 0, demoted: false, message: err.message || 'GPS processing failed.' };
  }
}

/**
 * Start continuous, high-accuracy location tracking.
 *
 * - watchPosition with enableHighAccuracy for real-time GPS
 * - Processes every 10 seconds for fast response
 * - Sends first update as soon as position is available
 * - Returns a cleanup function
 *
 * @param {string} appointmentId
 * @param {function} onStatusUpdate - receives status objects
 * @returns {function} cleanup
 */
export function startLocationTracking(appointmentId, onStatusUpdate) {
  let watchId = null;
  let intervalId = null;
  let lastPosition = null;
  let isProcessing = false;
  let stopped = false;

  async function tick() {
    if (!lastPosition || isProcessing || stopped) return;
    isProcessing = true;
    try {
      const result = await processLocationUpdate(appointmentId, lastPosition.lat, lastPosition.lng);
      if (!stopped && onStatusUpdate) onStatusUpdate(result);
    } catch (e) {
      if (!stopped && onStatusUpdate) {
        onStatusUpdate({ status: 'error', distance: 0, demoted: false, message: e.message });
      }
    } finally {
      isProcessing = false;
    }
  }

  if (navigator.geolocation) {
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const isFirst = !lastPosition;
        lastPosition = newPos;
        // Send immediately on first fix
        if (isFirst) tick();
      },
      (err) => {
        console.error('watchPosition error:', err);
        if (!stopped && onStatusUpdate) {
          onStatusUpdate({
            status: 'gps_error', distance: 0, demoted: false,
            message: 'GPS signal lost. Please ensure location services are enabled.',
          });
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 3000 }
    );

    // Process every 10 seconds for fast, live updates
    intervalId = setInterval(tick, 10000);
  } else {
    if (onStatusUpdate) {
      onStatusUpdate({ status: 'error', distance: 0, demoted: false, message: 'Geolocation not supported.' });
    }
  }

  return function cleanup() {
    stopped = true;
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    if (intervalId !== null) clearInterval(intervalId);
  };
}
