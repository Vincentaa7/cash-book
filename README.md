# 📒 Cash Book - Family Expense Tracker

A modern, responsive, and secure web application designed for families to manage their shared daily expenses and monthly budgets effectively.

![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat-square&logo=prisma)
![TailwindCSS](https://img.shields.io/badge/CSS-Vanilla-38B2AC?style=flat-square&logo=css3)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

---

## ✨ Features

- **📊 Interactive Dashboard**: Real-time summary of remaining budget, daily expense charts, and category distribution.
- **💸 Transaction Management**: Easily record expenditures with categories, dates, and member attribution.
- **👥 Family Members**: Support for up to 5 members with customized avatars and specific roles (Admin/Member).
- **🔒 Secure PIN Login**: Simple but secure authentication using personal PINs and JWT (Edge-compatible).
- **📅 Monthly Budgeting**: Admin can set flexible budget targets for every month.
- **🎨 Modern UI/UX**: Clean aesthetic with support for **Light** and **Dark** modes.
- **📱 Responsive Design**: Fully optimized for mobile, tablet, and desktop viewing.

---

## 🛠️ Tech Stack

- **Frontend**: [Next.js 14](https://nextjs.org/) (App Router), React, Lucide Icons.
- **Backend**: Next.js Route Handlers.
- **Database**: [TiDB Cloud](https://pingcap.com/products/tidb-cloud) (MySQL-compatible Serverless).
- **ORM**: [Prisma](https://www.prisma.io/).
- **Authentication**: [jose](https://github.com/panva/jose) (JWT for Edge Runtime).
- **Charts**: [Recharts](https://recharts.org/).

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18.x or later
- NPM or Yarn
- A TiDB Cloud or MySQL database instance

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/cash-book.git
   cd cash-book
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory and add your connection details:
   ```env
   DATABASE_URL="mysql://user:password@host:port/dbname?sslaccept=strict"
   JWT_SECRET="your-32-character-secret-key"
   ```

4. **Initialize the Database**:
   ```bash
   npx prisma db push
   npx prisma generate
   ```

5. **Run the Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

---

## 🔑 Default Account

After running the initial setup, you can login with the default administrator account:
- **Name**: `Admin`
- **PIN**: `1234`

*Note: Please change the Admin PIN immediately in the Settings page.*

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
