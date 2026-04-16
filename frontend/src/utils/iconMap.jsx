import { FiHeart, FiActivity, FiEye, FiUserPlus, FiDroplet, FiBox, FiSmile, FiPlusSquare } from 'react-icons/fi';

export function getDeptIcon(name, size = 24) {
  const n = (name || '').toLowerCase();
  
  if (n.includes('cardio') || n.includes('heart')) return <FiHeart size={size} />;
  if (n.includes('neuro') || n.includes('brain')) return <FiActivity size={size} />;
  if (n.includes('eye') || n.includes('ophthal')) return <FiEye size={size} />;
  if (n.includes('pediat') || n.includes('child')) return <FiUserPlus size={size} />;
  if (n.includes('derma') || n.includes('skin')) return <FiDroplet size={size} />;
  if (n.includes('ortho') || n.includes('bone')) return <FiBox size={size} />;
  if (n.includes('ent') || n.includes('nose') || n.includes('ear')) return <FiSmile size={size} />;
  
  return <FiPlusSquare size={size} />;
}
