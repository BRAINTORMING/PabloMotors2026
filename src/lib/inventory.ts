import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { brands as sampleBrands, vehicles as sampleVehicles } from '../data/dealership';

export type TagColor = 'success' | 'info' | 'warning' | 'danger' | 'neutral';

export interface Lookup {
  id: number;
  nombre: string;
}
export interface Tag extends Lookup {
  color: TagColor;
}

/** Vehicle as the site shows it (names already resolved from the related tables). */
export interface InventoryVehicle {
  id: number;
  fotoUrl: string | null;
  marca: string;
  modelo: string;
  anio: number;
  ofertaEspecial: boolean;
  tipo: string;
  combustible: string;
  etiqueta: string | null;
  etiquetaColor: TagColor;
  precio: number;
}

export const formatCLP = (value: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);

const SELECT =
  'id, foto_url, modelo, anio, oferta_especial, precio, marca:marcas(nombre), tipo:tipos_vehiculos(nombre), combustible:combustibles(nombre), etiqueta:etiquetas(nombre, color)';

// PostgREST returns a related row as an object (or an array in some client typings): accept both.
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

function fromRow(r: any): InventoryVehicle {
  const etiqueta = one<{ nombre: string; color: TagColor }>(r.etiqueta);
  return {
    id: r.id,
    fotoUrl: r.foto_url,
    marca: one<{ nombre: string }>(r.marca)?.nombre ?? '',
    modelo: r.modelo,
    anio: r.anio,
    ofertaEspecial: r.oferta_especial,
    tipo: one<{ nombre: string }>(r.tipo)?.nombre ?? '',
    combustible: one<{ nombre: string }>(r.combustible)?.nombre ?? '',
    etiqueta: etiqueta?.nombre ?? null,
    etiquetaColor: etiqueta?.color ?? 'neutral',
    precio: Number(r.precio),
  };
}

const sampleColor = { disponible: 'success', 'por llegar': 'info', vendido: 'danger' } as const;
const samples: InventoryVehicle[] = sampleVehicles.map((v) => ({
  id: v.id,
  fotoUrl: null,
  marca: v.brand,
  modelo: v.model,
  anio: v.year,
  ofertaEspecial: Boolean(v.featured),
  tipo: v.body,
  combustible: v.fuel,
  etiqueta: v.status[0].toUpperCase() + v.status.slice(1),
  etiquetaColor: sampleColor[v.status],
  precio: Number(v.price.replace(/\D/g, '')),
}));

export async function fetchVehicles(): Promise<InventoryVehicle[]> {
  if (!supabase) return samples;
  const { data, error } = await supabase.from('vehiculos').select(SELECT).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

async function fetchBrands(): Promise<string[]> {
  if (!supabase) return sampleBrands;
  const { data, error } = await supabase.from('marcas').select('nombre').order('nombre');
  if (error) throw error;
  return (data ?? []).map((r: { nombre: string }) => r.nombre);
}

// One request shared by every component of the home page.
let shared: Promise<{ vehicles: InventoryVehicle[]; brands: string[] }> | null = null;
const load = () =>
  (shared ??= Promise.all([fetchVehicles(), fetchBrands()])
    .then(([vehicles, brands]) => ({ vehicles, brands }))
    .catch(() => {
      shared = null;
      return { vehicles: samples, brands: sampleBrands };
    }));

/** Public catalog data. While Supabase is not configured (or fails) the site shows its sample vehicles. */
export function useInventory() {
  const [data, setData] = useState({ vehicles: samples, brands: sampleBrands });
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    load().then((d) => {
      if (!alive) return;
      setData(d);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  return { ...data, loading };
}

/** Loads the four catalog tables used by the admin forms. */
export function useCatalogs() {
  const [marcas, setMarcas] = useState<Lookup[]>([]);
  const [tipos, setTipos] = useState<Lookup[]>([]);
  const [combustibles, setCombustibles] = useState<Lookup[]>([]);
  const [etiquetas, setEtiquetas] = useState<Tag[]>([]);

  const reload = useCallback(async () => {
    if (!supabase) return;
    const [m, t, c, e] = await Promise.all([
      supabase.from('marcas').select('id, nombre').order('nombre'),
      supabase.from('tipos_vehiculos').select('id, nombre').order('nombre'),
      supabase.from('combustibles').select('id, nombre').order('nombre'),
      supabase.from('etiquetas').select('id, nombre, color').order('nombre'),
    ]);
    setMarcas((m.data as Lookup[]) ?? []);
    setTipos((t.data as Lookup[]) ?? []);
    setCombustibles((c.data as Lookup[]) ?? []);
    setEtiquetas((e.data as Tag[]) ?? []);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { marcas, tipos, combustibles, etiquetas, reload };
}
