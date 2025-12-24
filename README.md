# IM Connect

<div align="center">
  <p>
    <a href="./README.md">English</a> | <a href="./README_CN.md">简体中文</a>
  </p>
</div>


IM Connect is a robust, real-time instant messaging platform designed to bridge the gap between **Enterprises** and **Industry Experts**. It provides a seamless communication channel tailored for consultation, technical support, and professional collaboration.

## 🚀 Features

- **Role-Based System**: Distinct workflows and profiles for **Enterprises** (seeking help) and **Experts** (providing solutions).
- **Real-Time Messaging**: Low-latency chat powered by WebSockets.
- **Multimedia Support**:
  - Text, Emoji
  - Image sharing (with preview)
  - File attachments
- **Smart Chat Features**:
  - Message Read/Unread Status
  - Message Recall (Soft delete)
  - Unread Message Counters
  - Pinned Conversations
- **User Profiles**: Rich profile management including specialized tags, bios, and organizational info.
- **Search**: Efficient lookup for messages and contacts.
- **Responsive UI**: Modern, clean interface built with Tailwind CSS and Framer Motion.

## 🛠 Tech Stack

### Frontend
- **Core**: [React 19](https://react.dev/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **State & Routing**: React Router DOM, Custom Hooks.
- **Icons**: Lucide React.
- **Animations**: Framer Motion.

### Backend
- **Runtime**: [Node.js](https://nodejs.org/)
- **Server Framework**: [Express.js](https://expressjs.com/)
- **Real-Time Communication**: [ws](https://github.com/websockets/ws) (WebSocket)
- **Database**: SQLite (Development) / Compatible with PostgreSQL/MySQL.
- **ORM**: [Prisma](https://www.prisma.io/)
- **Object Storage**: Support for Local Storage and Aliyun OSS.

## 🏁 Getting Started

Follow these instructions to get the project up and running on your local machine.

### Prerequisites

- **Node.js**: v18 or higher
- **Package Manager**: [pnpm](https://pnpm.io/) (recommended) or npm

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/7-ch/im-connect.git
   cd im-connect
   ```

2. **Install Dependencies**
   ```bash
   pnpm install
   ```

3. **Environment Configuration**
   Create a `.env` file in the root directory. You can reference the following keys:
   ```env
   # Database
   DATABASE_URL="file:./dev.db"

   # Server
   PORT=8080

   
   # Object Storage (Optional - defaults to local FS if not set)
   OSS_REGION=
   OSS_ACCESS_KEY_ID=
   OSS_ACCESS_KEY_SECRET=
   OSS_BUCKET=
   ```

4. **Database Setup**
   Generate the Prisma client and push the schema to the database.
   ```bash
   pnpm db:migrate
   ```

5. **Seed Data (Optional)**
   Populate the database with initial users and conversations for testing.
   ```bash
   pnpm db:seed
   ```

### Running the Application

You can run the frontend and backend separately.

**1. Start the Backend Server**
```bash
node server.js
```
> The server will start on port `8080` (or your configured port).

**2. Start the Frontend Development Server**
```bash
pnpm dev
```
> The application will be accessible at `http://localhost:5173`.

## 📂 Project Structure

```bash
├── src/                # Frontend application
│   ├── components/     # Reusable UI components (ChatBubble, ContactList, etc.)
│   ├── pages/          # Main route pages (Login, Chat, etc.)
│   ├── hooks/          # Custom React hooks (useAuth, usesSocket, etc.)
│   ├── utils/          # Frontend helpers
│   └── assets/         # Static assets
├── server/             # Backend application
│   ├── routes/         # Express API routes
│   ├── socket.js       # WebSocket event handlers
│   └── seed.js         # Database seeding logic
├── prisma/             # Database schema and migrations
├── public/             # Public static files
└── scripts/            # Utility scripts
```

## 📜 Key Scripts

- `pnpm dev`: Start frontend dev server.
- `pnpm build`: Build frontend for production.
- `pnpm db:studio`: Open Prisma Studio to view/edit database records.
- `pnpm db:reset`: Reset database (Caution: deletes all data).


## 🚢 Deployment

For detailed deployment instructions, please refer to [DEPLOY.md](./DEPLOY.md).

We provide a convenient shell script to automate the deployment process:

```bash
./scripts/deploy.sh
```

## 🤝 Contributing

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
