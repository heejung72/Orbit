require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const tasteRoutes = require('./routes/tastes');
const matchingRoutes = require('./routes/matching');
const chatRoutes = require('./routes/chat');
const clubRoutes = require('./routes/clubs');
const reportRoutes = require('./routes/reports');
const publicRoutes = require('./routes/public');
const { setupSocket } = require('./services/socket');
const { authMiddleware, membersOnly } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());

// Public routes (비로그인 접근 가능)
app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);

// Protected routes (로그인 + 게스트 모두 접근 가능)
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/tastes', authMiddleware, tasteRoutes);
app.use('/api/chat', authMiddleware, chatRoutes);
app.use('/api/clubs', authMiddleware, clubRoutes);

// Members only (회원 전용 - 게스트 차단)
app.use('/api/matching', authMiddleware, membersOnly, matchingRoutes);
app.use('/api/reports', authMiddleware, membersOnly, reportRoutes);

// Socket.io
setupSocket(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Orbit server running on port ${PORT}`);
});

module.exports = { app, server };
