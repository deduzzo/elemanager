import './leaflet-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
} from 'react-leaflet';
import type { Map as LeafletMap, LatLngBoundsExpression } from 'leaflet';
import L from 'leaflet';
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

type SezioneGeo = SezioneRow & { lat: number; lng: number };

interface MappaSezioniProps {
  sezioni: SezioneRow[];
}

interface SezioneConDistanza {
  sezione: SezioneGeo;
  distanzaKm: number;
}

export function MappaSezioni({ sezioni }: MappaSezioniProps) {
  const { push } = useToast();
  const mapRef = useRef<LeafletMap | null>(null);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [vicine, setVicine] = useState<SezioneConDistanza[]>([]);
  const [loadingGeo, setLoadingGeo] = useState(false);

  const sezioniGeo = useMemo<SezioneGeo[]>(() => {
    return sezioni
      .map((s) => ({
        ...s,
        lat: s.lat == null ? NaN : Number(s.lat),
        lng: s.lng == null ? NaN : Number(s.lng),
      }))
      .filter(
        (s): s is SezioneGeo =>
          Number.isFinite(s.lat) && Number.isFinite(s.lng),
      );
  }, [sezioni]);

  // Ogni volta che cambiano i marker, inquadra la mappa sui bounds reali.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (sezioniGeo.length === 0) {
      map.setView(MESSINA_CENTER, 12);
      return;
    }
    const bounds: LatLngBoundsExpression = sezioniGeo.map((s) => [s.lat, s.lng]);
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
  }, [sezioniGeo]);

  // Se l'utente clicca "Trova vicine", centra sulla sua posizione a zoom stretto.
  useEffect(() => {
    const map = mapRef.current;
    if (map && userPos) {
      map.setView(userPos, 15);
    }
  }, [userPos]);

  const handleTrovaVicine = () => {
    if (!('geolocation' in navigator)) {
      push('Geolocalizzazione non supportata dal browser', { type: 'error' });
      return;
    }
    if (sezioniGeo.length === 0) {
      push('Nessuna sezione con coordinate valide', { type: 'error' });
      return;
    }
    setLoadingGeo(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const me: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserPos(me);
        const top = sezioniGeo
          .map<SezioneConDistanza>((s) => ({
            sezione: s,
            distanzaKm: haversineKm(me, [s.lat, s.lng]),
          }))
          .sort((a, b) => a.distanzaKm - b.distanzaKm)
          .slice(0, 5);
        setVicine(top);
        setLoadingGeo(false);
      },
      (err) => {
        setLoadingGeo(false);
        push(
          err.code === err.PERMISSION_DENIED
            ? 'Permesso geolocalizzazione negato'
            : 'Errore di geolocalizzazione',
          { type: 'error' },
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-slate-400">
          {sezioniGeo.length} sezioni geolocalizzate su {sezioni.length}
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
        center={MESSINA_CENTER}
        zoom={12}
        style={{ height: '480px' }}
        className="rounded-2xl overflow-hidden"
        ref={(instance) => {
          if (instance) mapRef.current = instance as unknown as LeafletMap;
        }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />
        {sezioniGeo.map((s) => (
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

// Silence lint: L import kept for future use (e.g., custom icons)
void L;
