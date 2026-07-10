export type Role = "EMPLOYEE" | "MANAGER" | "ADMIN";
export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export type LeaveType = {
  id: string;
  name: string;
  maxDays: number;
};

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  department?: string | null;
  managerId?: string | null;
  manager?: Pick<User, "id" | "name" | "email"> | null;
  leaveBalances?: LeaveBalance[];
};

export type LeaveBalance = {
  id: string;
  userId: string;
  leaveTypeId: string;
  balance: number;
  leaveType: LeaveType;
  user?: User;
};

export type LeaveRequest = {
  id: string;
  userId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  status: LeaveStatus;
  reason: string;
  createdAt: string;
  user?: User;
  leaveType?: LeaveType;
};

export type LoginResponse = {
  token: string;
  user: User;
};
