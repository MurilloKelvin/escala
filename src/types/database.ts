export type Employee = {
  id: string;
  user_id: string;
  name: string;
  daily_rate_cents: number;
  phone: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};
export type EmployeeWeek = {
  id: string;
  user_id: string;
  employee_id: string;
  week_start: string;
  daily_rate_cents: number;
  status: 'pending' | 'paid';
  paid_at: string | null;
  created_at: string;
};
export type WorkDay = {
  id: string;
  user_id: string;
  employee_week_id: string;
  work_date: string;
  created_at: string;
};
type Table<Row, Insert, Update> = { Row: Row; Insert: Insert; Update: Update; Relationships: [] };
export type EmployeeInput = Pick<Employee, 'name' | 'daily_rate_cents' | 'phone' | 'notes'>;
export interface Database {
  public: {
    Tables: {
      employees: Table<
        Employee,
        EmployeeInput & { user_id: string },
        Partial<EmployeeInput> & { active?: boolean }
      >;
      employee_weeks: Table<
        EmployeeWeek,
        { user_id: string; employee_id: string; week_start: string },
        { status: 'pending' | 'paid' }
      >;
      work_days: Table<
        WorkDay,
        { user_id: string; employee_week_id: string; work_date: string },
        never
      >;
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
