export interface Pill {
  id: string;
  name: string;
  dose: string;
  time: string; // formato HH:mm
  takenDates: string[]; // array de fechas (YYYY-MM-DD) en que se ha tomado
  frequency?: 'daily' | 'specific_days';
  selectedDays?: number[]; // 0=Dom, 1=Lun, 2=Mar, 3=Mie, 4=Jue, 5=Vie, 6=Sab
  createdAt?: string; // Fecha en que se creó (YYYY-MM-DD) para no mostrarla antes de esta fecha
  emoji?: string;
  color?: string;
  // Gestión de Stock (Baúl)
  stockEnabled?: boolean;
  totalStock?: number;
  quantityPerDose?: number;
  unit?: string; // 'mg', 'pastillas', 'ml', etc.
}
