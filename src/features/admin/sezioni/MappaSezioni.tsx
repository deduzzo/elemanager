import './leaflet-icons';
import { useMemo, useState } from 'react';
import {
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import { Button, useToast } from '@/components/ui';
import type { SezioneRow } from '@/lib/database.types';

const MESSINA_CENTER: [number, number] = [38.1938, 15.554];

function haversineKm(a: [number, number], b: [number, number]) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const la1 = toRad(a[0]);
  const la2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

interface MappaSezioniProps {
  sezioni: SezioneRow[];
}

interface SezioneConDistanza {
  sezione: SezioneRow;
  distanzaKm: number;
}

/**
 * Componente interno che aggiorna centro/zoom della mappa quando cambia la
 * posizione utente. Usa useMap() che funziona solo dentro <MapContainer>.
 */
function FlyToUser({ pos }: { pos: [number, number] | null }) {
  const map = useMap();
  if (pos) {
    map.setView(pos, 15);
  }
  return null;
}

export function MappaSezioni({ sezioni }: MappaSezioniProps) {
  const { push } = useToast();
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [vicine, setVicine] = useState<SezioneConDistanza[]>([]);
  const [loadingGeo, setLoadingGeo] = useState(false);

  const sezioniConCoord = useMemo(
    () =>
      sezioni.filter(
        (s): s is SezioneRow & { lat: number; lng: number } =>
          s.lat !== null && s.lng !== null,
      ),
    [sezioni],
  );

  const center: LatLngExpression = useMemo(() => {
    if (sezioniConCoord.length === 0) return MESSINA_CENTER;
    const avgLat =
      sezioniConCoord.reduce((acc, s) => acc + s.lat, 0) /
      sezioniConCoord.length;
    const avgLng =
      sezioniConCoord.reduce((acc, s) => acc + s.lng, 0) /
      sezioniConCoord.length;
    return [avgLat, avgLng];
  }, [sezioniConCoord]);

  const handleTrovaVicine = () => {
    if (!('geolocation' in navigator)) {
      push('Geolocalizzazione non supportata dal browser', { type: 'error' });
      return;
    }
    if (sezioniConCoord.length === 0) {
      push('Nessuna sezione con coordinate valide', { type: 'error' });
      return;
    }
    setLoadingGeo(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userCoords: [number, number] = [
          pos.coords.latitude,
          pos.coords.longitude,
        ];
        setUserPos(userCoords);
        const conDist = sezioniConCoord
          .map<SezioneConDistanza>((s) => ({
            sezione: s,
            distanzaKm: haversineKm(userCoords, [s.lat, s.lng]),
          }))
          .sort((a, b) => a.distanzaKm - b.distanzaKm)
          .slice(0, 5);
        setVicine(conDist);
        setLoadingGeo(false);
      },
      (err) => {
        setLoadingGeo(false);
        if (err.code === err.PERMISSION_DENIED) {
          push('Permesso geolocalizzazione negato', { type: 'error' });
        } else {
          push('Errore di geolocalizzazione', { type: 'error' });
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-slate-400">
          {sezioniConCoord.length} sezioni geolocalizzate su {sezioni.length}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleTrovaVicine}
          disabled={loadingGeo}
        >
          {loadingGeo ? 'Ricerca...' : '📍 Trova le più vicine'}
        </Button>
      </div>

      <MapContainer
        center={center}
        zoom={12}
        style={{ height: '480px' }}
        className="rounded-2xl overflow-hidden"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{y}/{x}.png"
          attribution='&copy; OpenStreetMap contributors'
        />
        {sezioniConCoord.map((s) => (
          <Marker key={s.id} position={[s.lat, s.lng]}>
            <Popup>
              <strong>Sezione {s.numero}</strong>
              <br />
              {s.ubicazione ?? ''}
              <br />
              {s.indirizzo ?? ''}
              <br />
              Circoscrizione: {s.circoscrizione ?? '-'}
            </Popup>
          </Marker>
        ))}
        {userPos && (
          <CircleMarker
            center={userPos}
            radius={10}
            pathOptions={{
              color: '#22d3ee',
              fillColor: '#22d3ee',
              fillOpacity: 0.6,
            }}
          >
            <Popup>La tua posizione</Popup>
          </CircleMarker>
        )}
        <FlyToUser pos={userPos} />
      </MapContainer>

      {vicine.length > 0 && (
        <div className="glass p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-2">
            Top 5 sezioni più vicine
          </h3>
          <ul className="space-y-1 text-sm">
            {vicine.map((v) => (
              <li
                key={v.sezione.id}
                className="flex items-center justify-between border-b border-white/5 pb-1 last:border-0"
              >
                <span className="text-slate-200">
                  Sezione {v.sezione.numero}
                  {v.sezione.ubicazione ? ` — ${v.sezione.ubicazione}` : ''}
                </span>
                <span className="text-neon-cyan font-mono">
                  {v.distanzaKm.toFixed(1)} km
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
