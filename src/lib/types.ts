export interface Pill {
  id: string;
  name: string;
  dose: string;
  time: string; // Mantenemos por compatibilidad (primer horario)
  times?: string[]; // Lista de todos los horarios (ej: ["08:00", "20:00"])
  takenDates: string[]; // Ahora guardará formato "YYYY-MM-DD|HH:mm"
  frequency?: 'daily' | 'specific_days';
  selectedDays?: number[];
  createdAt?: string;
  updatedAt?: string;
  deleted?: boolean;
  emoji?: string;
  color?: string;
  stockEnabled?: boolean;
  totalStock?: number;
  quantityPerDose?: number;
  unit?: string;
}
