# Employee Leave Management System

A full-stack Employee Leave Management System built using **Next.js, React, Node.js, Express, PostgreSQL, and Prisma ORM**. The application provides secure role-based access for Employees, Managers, and Administrators to manage leave requests, approvals, leave balances, reports, and user management.

---

# Live Demo

https://leave-management-system-rho-three.vercel.app

---

# Tech Stack

## Frontend
- Next.js (App Router)
- React
- TypeScript
- Tailwind CSS
- React Query
- Axios

## Backend
- Node.js
- Express.js
- Prisma ORM
- PostgreSQL
- JWT Authentication
- bcrypt

## Testing
- Jest
- React Testing Library

---

# Features Implemented

## Authentication

- Secure Login
- Logout
- JWT Authentication
- Password Hashing
- Protected Routes
- Role-Based Authorization

---

## Employee

- Apply Leave
- View Leave History
- View Leave Balance
- Cancel Pending Leave Requests
- Dashboard Overview
- Notifications

---

## Manager

- View Team Leave Requests
- Approve Leave Requests
- Reject Leave Requests
- Team Dashboard
- Leave Notifications

---

## Admin

- User Management
- Leave Type Management
- Leave Policy Management
- Leave Summary Report
- Leave Balance Report
- Dashboard Analytics

---

## Reports

- Leave Summary
- Leave Balance
- Department-wise Statistics
- Employee-wise Statistics

---

## Additional Features

- Responsive Design
- Loading States
- Form Validation
- Toast Notifications
- Error Handling
- Notification Center
- RESTful APIs
- Role-Based Navigation

---

# Folder Structure

```
Intern-Hiring-React
│
├── client
│   ├── app
│   ├── components
│   ├── hooks
│   ├── lib
│   ├── services
│   ├── styles
│   └── tests
│
├── server
│   ├── controllers
│   ├── middleware
│   ├── prisma
│   ├── routes
│   ├── services
│   ├── utils
│   └── tests
│
└── README.md
```

---

# Installation

## Clone Repository

```bash
git clone https://github.com/Phaneendra2005/leave-management-system.git
```

```
cd Intern-Hiring-React
```

---

# Backend Setup

```
cd server
```

Install dependencies

```
npm install
```

Generate Prisma Client

```
npx prisma generate
```

Run migrations

```
npx prisma migrate deploy
```

Start server

```
npm run dev
```

---

# Frontend Setup

```
cd client
```

Install dependencies

```
npm install
```

Start development server

```
npm run dev
```

---

# Environment Variables

## Backend (.env)

```
DATABASE_URL=<POSTGRES_DATABASE_URL>

JWT_SECRET=<YOUR_SECRET_KEY>

PORT=5000
```

---

## Frontend (.env.local)

```
NEXT_PUBLIC_API_URL=<YOUR_RENDER_URL>
```

---

# API Endpoints

## Authentication

| Method | Endpoint |
|---------|----------|
| POST | /api/auth/login |
| POST | /api/auth/logout |
| GET | /api/users/me |

---

## Users

| Method | Endpoint |
|---------|----------|
| GET | /api/users |
| POST | /api/users |
| PUT | /api/users/:id |
| DELETE | /api/users/:id |

---

## Leave Types

| Method | Endpoint |
|---------|----------|
| GET | /api/leave-types |
| POST | /api/leave-types |
| PUT | /api/leave-types/:id |
| DELETE | /api/leave-types/:id |

---

## Leave Requests

| Method | Endpoint |
|---------|----------|
| GET | /api/leave-requests |
| POST | /api/leave-requests |
| PUT | /api/leave-requests/:id |
| POST | /api/leave-requests/:id/cancel |

---

## Reports

| Method | Endpoint |
|---------|----------|
| GET | /api/reports/leave-summary |
| GET | /api/reports/leave-balance |

---

## Notifications

| Method | Endpoint |
|---------|----------|
| GET | /api/notifications |
| PUT | /api/notifications/:id/read |
| PUT | /api/notifications/read-all |

---

# Testing

## Backend

```
cd server

npm test
```

Tests include

- Authentication
- Authorization
- Leave Requests
- Notifications
- Validation
- API Controllers

---

## Frontend

```
cd client

npm test
```

Tests include

- Login
- Dashboard
- Leave Application
- Leave History
- Protected Routes
- Notification Component

---

# Deployment

## Frontend

Hosted on **Vercel**

```
https://leave-management-system-rho-three.vercel.app
```

---

## Backend

Hosted on **Render**

```
https://leave-management-system-xdn0.onrender.com
```

---

# Demo Credentials

## Admin

```
Email:
admin@example.com

Password:
Admin@123
```

---

## Manager

```
Email:
manager@example.com

Password:
Manager@123
```

---

## Employee

```
Email:
employee@example.com

Password:
Employee@123
```

> Replace the above with the actual seeded credentials from your database.

---

# Screenshots

Recommended screenshots:

- Login Page
- Employee Dashboard
- Manager Dashboard
- Admin Dashboard
- Apply Leave
- Leave Requests
- Reports
- Notification Panel

---

# Project Highlights

- JWT Authentication
- Secure Password Hashing
- Prisma ORM
- PostgreSQL Database
- RESTful API Design
- Responsive UI
- Role-Based Access Control
- Clean Architecture
- Production Deployment
- Unit Testing

---

# Future Improvements

- Email Notifications
- Real-Time Notifications (WebSockets)
- Calendar Drag-and-Drop
- Excel Export
- PDF Reports
- Integration Tests
- End-to-End Testing
- Multi-language Support
- Audit Dashboard
- Mobile Application

---

# Author

**Phaneendra Kanduri**

B.Tech Computer Science & Engineering (Cyber Security)

GitHub:
https://github.com/Phaneendra2005

LinkedIn:
https://www.linkedin.com/in/phaneendra-kanduri/

---

# License

This project was developed as part of the **ReadNRevise Full Stack Intern Technical Assessment** and is intended solely for evaluation purposes.