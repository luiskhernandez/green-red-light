type Mood = 'green' | 'red' | 'happy' | 'sleepy';

/**
 * Semaforo con cara: personaje propio, dibujado en SVG para que escale sin
 * imagenes y no pese nada.
 *
 * En rojo levanta una mano abierta de "pare"; en verde saluda y camina. La
 * mano va en color claro para que se lea sobre fondo verde, rojo y amarillo.
 */
export function Mascot({ mood }: { mood: Mood }) {
  const lightOn = mood === 'red' ? 'red' : 'green';
  const label =
    lightOn === 'red'
      ? 'Semaforo en rojo con la mano levantada'
      : 'Semaforo en verde sonriendo';

  return (
    <svg
      className={mood === 'green' ? 'mascot mascot--walking' : 'mascot mascot--frozen'}
      viewBox="0 0 140 140"
      role="img"
      aria-label={label}
    >
      {/* Cuerpo */}
      <rect x="34" y="10" width="72" height="112" rx="28" fill="#12203a" />
      <rect x="42" y="18" width="56" height="96" rx="22" fill="#22355c" />

      {/* Luces: solo una encendida */}
      <circle cx="70" cy="46" r="18" fill={lightOn === 'red' ? '#ff5a4e' : '#5b2723'} />
      <circle cx="70" cy="86" r="18" fill={lightOn === 'green' ? '#3ddc97' : '#17402f'} />

      {/* Cara en la luz encendida */}
      <g fill="#0b1120">
        <circle cx={63} cy={lightOn === 'red' ? 42 : 82} r="2.8" />
        <circle cx={77} cy={lightOn === 'red' ? 42 : 82} r="2.8" />
      </g>
      {lightOn === 'red' ? (
        // Boca recta: concentrado, quieto.
        <rect x="61" y="51" width="18" height="4" rx="2" fill="#0b1120" />
      ) : (
        <path
          d="M60 89 Q70 99 80 89"
          stroke="#0b1120"
          strokeWidth="3.6"
          fill="none"
          strokeLinecap="round"
        />
      )}

      {/* Brazo derecho, siempre por fuera de la silueta del cuerpo */}
      {lightOn === 'red' ? (
        <g fill="#fff8ec">
          {/* Antebrazo levantado */}
          <rect x="104" y="44" width="10" height="30" rx="5" />
          {/* Palma */}
          <rect x="100" y="20" width="19" height="24" rx="9" />
          {/* Dedos: dejan claro que es una mano de "pare" */}
          <rect x="101" y="10" width="4.5" height="13" rx="2.25" />
          <rect x="107" y="7" width="4.5" height="16" rx="2.25" />
          <rect x="113" y="10" width="4.5" height="13" rx="2.25" />
        </g>
      ) : (
        <g fill="#fff8ec">
          {/* Brazo saludando */}
          <rect x="104" y="40" width="10" height="28" rx="5" />
          <circle cx="109" cy="33" r="9" />
        </g>
      )}

      {/* Base / pies */}
      <rect x="52" y="122" width="36" height="9" rx="4.5" fill="#ffc93c" />
      <rect x="44" y="131" width="52" height="8" rx="4" fill="#ffc93c" />
    </svg>
  );
}
