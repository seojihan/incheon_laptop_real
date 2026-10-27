export type UserRole = 'student' | 'teacher' | 'admin' | 'helper';

export type RequestType = 'home' | 'class';
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'returned' | 'cancelled';

export interface UserProfile {
  user_id: string;
  role: UserRole;
  student_id?: string | null;
  student_name: string;
  grade?: string | null;
  class_num?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
  archived_at?: string | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  studentId?: string;
  classNum?: string;
  grade?: string;
}

export interface RentalSlot {
  dayIdx: number;
  periodIdx: number;
}

export interface LaptopRequest {
  id: string;
  userId: string;
  userName: string;
  studentId: string;
  grade: string;
  classNum: string;
  type: RequestType;
  status: RequestStatus;
  startDate: string;
  endDate?: string;
  slots?: RentalSlot[];
  reason?: string;
  weekLabel?: string;
  rentalYear?: number;
  rentalMonth?: number;
  rentalWeek?: number;
  notebookNumber?: number;
  reviewNote?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface NotebookInventoryItem {
  number: number;
  assetTag: string;
  condition: 'available' | 'maintenance' | 'retired';
  homeRentalCount: number;
  activeRentalType?: RequestType;
  activeRentalStartDate?: string;
  activeRentalEndDate?: string;
  note?: string;
  activeRequest?: LaptopRequest;
}

export interface AppNotification {
  id: string;
  userId: string;
  requestId?: string;
  title: string;
  message: string;
  readAt?: string;
  createdAt: string;
}

export interface InternalHelpArticle {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  allowedRoles: UserRole[];
  sortOrder: number;
  updatedAt: string;
}

export type ViewType =
  | 'home'
  | 'records'
  | 'home-rental'
  | 'class-rental'
  | 'notifications'
  | 'info'
  | 'guide'
  | 'terms'
  | 'admin-approval'
  | 'settings'
  | 'notebook-inventory';
