import React, { useEffect, useState } from 'react';
import { calculateQibla } from '../utils/prayerTimes';
import { Compass, MapPin, RefreshCw, AlertCircle } from 'lucide-react';

interface QiblaCompassProps {
  latitude: number;
  longitude: number;
  cityName: string;
}

export const QiblaCompass: React.FC<QiblaCompassProps> = ({ latitude, longitude, cityName }) => {
  const [qiblaAngle, setQiblaAngle] = useState<number>(0);
  const [deviceHeading, setDeviceHeading] = useState<number>(0);
  const [isSensorAvailable, setIsSensorAvailable] = useState<boolean>(false);
  const [distanceToKaaba, setDistanceToKaaba] = useState<number>(0);
  const [manualRotation, setManualRotation] = useState<number>(0);

  // Compute Qibla angle and distance to Kaaba on mount / coordinates change
  useEffect(() => {
    const angle = calculateQibla(latitude, longitude);
    setQiblaAngle(angle);

    // Haversine formula to compute distance to Mecca (Lat: 21.4225, Lon: 39.8262)
    const R = 6371; // Earth's radius in km
    const lat1 = (latitude * Math.PI) / 180;
    const lat2 = (21.4225 * Math.PI) / 180;
    const dLat = ((21.4225 - latitude) * Math.PI) / 180;
    const dLon = ((39.8262 - longitude) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const dist = R * c;
    setDistanceToKaaba(Math.round(dist));
  }, [latitude, longitude]);

  // Try to bind device orientation events
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      // absolute heading if available, fallback to alpha
      let heading = 0;
      if ((e as any).webkitCompassHeading) {
        heading = (e as any).webkitCompassHeading;
        setIsSensorAvailable(true);
      } else if (e.alpha !== null) {
        heading = 360 - e.alpha; // approximate alpha-based heading
        setIsSensorAvailable(true);
      }
      setDeviceHeading(heading);
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, []);

  // Manual rotation adjuster for desktop users
  const rotateManualClockwise = () => {
    setManualRotation((prev) => (prev + 15) % 360);
  };

  const resetManualRotation = () => {
    setManualRotation(0);
  };

  // The angle pointing to the Kaaba from the current orientation
  // On device with sensor: (Qibla - Heading)
  // On desktop: (Qibla - ManualRotation)
  const pointerAngle = isSensorAvailable
    ? (qiblaAngle - deviceHeading + 360) % 360
    : (qiblaAngle - manualRotation + 360) % 360;

  return (
    <div className="flex flex-col items-center p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl" id="qibla-compass-card">
      <div className="text-center mb-6">
        <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center justify-center gap-2">
          <Compass className="w-5 h-5 text-amber-500 animate-pulse" />
          <span>اتجاه القبلة الشريفة</span>
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-center gap-1 font-sans">
          <MapPin className="w-3.5 h-3.5 text-slate-400" />
          <span>من {cityName} | زاوية القبلة: {Math.round(qiblaAngle)}°</span>
        </p>
      </div>

      {/* Compass Circular Stage */}
      <div className="relative w-64 h-64 flex items-center justify-center bg-slate-50 dark:bg-slate-850 rounded-full border-4 border-slate-100 dark:border-slate-800 shadow-inner overflow-hidden">
        {/* Background dial markings */}
        <div 
          className="absolute inset-0 border-2 border-dashed border-slate-200/60 dark:border-slate-700/60 rounded-full transition-transform duration-300"
          style={{ transform: `rotate(-${isSensorAvailable ? deviceHeading : manualRotation}deg)` }}
        >
          {/* Cardinal Directions */}
          <span className="absolute top-2 left-1/2 -translate-x-1/2 text-xs font-bold text-slate-400 font-sans">N (شمال)</span>
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs font-bold text-slate-400 font-sans">S (جنوب)</span>
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-sans">E (شرق)</span>
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-sans">W (غرب)</span>
        </div>

        {/* Outer compass ring */}
        <div className="absolute inset-8 rounded-full border border-slate-100 dark:border-slate-800" />

        {/* Compass Needle Pointer pointing to Kaaba */}
        <div 
          className="absolute w-full h-full flex items-center justify-center transition-transform duration-200 ease-out"
          style={{ transform: `rotate(${pointerAngle}deg)` }}
        >
          {/* Beautiful double-pointed traditional compass needle */}
          <div className="relative w-4 h-48 flex flex-col justify-between items-center">
            {/* Kaaba indicator needle (Gold/Amber) */}
            <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[80px] border-b-amber-500 drop-shadow-[0_2px_4px_rgba(245,158,11,0.5)] flex items-center justify-center relative">
              {/* Kaaba micro-icon block at top tip */}
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] px-1 bg-amber-600 text-white rounded font-bold font-sans">
                القبلة
              </div>
            </div>
            
            {/* Center core */}
            <div className="w-5 h-5 bg-slate-800 dark:bg-slate-200 border-4 border-white dark:border-slate-900 rounded-full z-10 shadow" />
            
            {/* South needle (Slate) */}
            <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[80px] border-t-slate-300 dark:border-t-slate-700" />
          </div>
        </div>

        {/* Center label */}
        <div className="absolute flex flex-col items-center bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm z-20 pointer-events-none">
          <span className="text-[10px] text-slate-400 font-sans">الحساب</span>
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100 font-sans">
            {Math.round(pointerAngle)}°
          </span>
        </div>
      </div>

      {/* Manual Controls / Calibration Guidance */}
      <div className="w-full mt-6 flex flex-col items-center gap-3">
        {isSensorAvailable ? (
          <div className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl text-center font-sans">
            ● يتم تدوير البوصلة تلقائياً عبر مستشعر الهاتف المغناطيسي.
          </div>
        ) : (
          <div className="w-full flex flex-col gap-2">
            <p className="text-[11px] text-slate-400 text-center font-sans flex items-center justify-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>قم بتدوير القرص يدوياً لمطابقة اتجاه الشمال الحقيقي لديك:</span>
            </p>
            <div className="flex gap-2">
              <button
                onClick={rotateManualClockwise}
                className="flex-1 py-1.5 px-3 bg-slate-50 hover:bg-amber-50 dark:bg-slate-850 dark:hover:bg-amber-950/20 border border-slate-100 dark:border-slate-850 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5 transition-colors"
                id="qibla-rotate-btn"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>تدوير +15°</span>
              </button>
              <button
                onClick={resetManualRotation}
                className="py-1.5 px-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-850 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 transition-colors"
                id="qibla-reset-btn"
              >
                تصفير
              </button>
            </div>
          </div>
        )}

        {/* Distance summary card */}
        <div className="w-full mt-2 p-3 bg-amber-50/50 dark:bg-amber-950/10 border border-amber-100/30 rounded-2xl flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-sans">البعد عن الكعبة الشريفة</span>
          <span className="font-bold text-amber-800 dark:text-amber-400 font-mono">
            {distanceToKaaba.toLocaleString('ar-EG')} كم
          </span>
        </div>
      </div>
    </div>
  );
};
