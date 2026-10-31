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
const loungeRoutes = require('./routes/lounges');
const reportRoutes = require('./routes/reports');
const publicRoutes = require('./routes/public');
const guestRoutes = require('./routes/guest');
const questionRoutes = require('./routes/questions');
const { setupSocket } = require('./socket');
const optionalAuth = require('./middleware/optionalAuth');
const memberAuth = require('./middleware/memberAuth');

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
app.use('/api/guest', guestRoutes); // #5

// Protected routes (로그인 + 게스트 모두 접근 가능)
app.use('/api/users', optionalAuth, userRoutes);
app.use('/api/tastes', optionalAuth, tasteRoutes);
app.use('/api/chat', optionalAuth, chatRoutes);
app.use('/api/lounges', optionalAuth, loungeRoutes);
app.use('/api/questions', optionalAuth, questionRoutes); // #15

// Members only (회원 전용 - 게스트 차단)
// TODO(#13, #16): PRD상 Guest도 매칭·신고 가능 → optionalAuth로 전환
app.use('/api/matching', memberAuth, matchingRoutes);
app.use('/api/reports', memberAuth, reportRoutes);

// Socket.io
setupSocket(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Orbit server running on port ${PORT}`);
});

module.exports = { app, server };
