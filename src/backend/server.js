require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const tasteRoutes = require('./routes/tastes');
const homeRoutes = require('./routes/home');
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
const { connectRedis } = require('./redis');
const { startGuestCleanup } = require('./jobs/guestExpiry');
const { resetOnline } = require('./services/online');

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

// 회원 + Guest (Guest 요청엔 req.userId가 없음 → 라우트에서 req.isGuest로 분기)
app.use('/api/home', optionalAuth, homeRoutes); // #8
app.use('/api/tastes', optionalAuth, tasteRoutes);
app.use('/api/lounges', optionalAuth, loungeRoutes); // #11: Guest 참여는 Redis
app.use('/api/questions', optionalAuth, questionRoutes); // #15
app.use('/api/chat', optionalAuth, chatRoutes); // #10, #13: Guest가 낀 1:1 방은 Redis
app.use('/api/matching', optionalAuth, matchingRoutes); // #13: Guest 요청·방은 Redis

// 회원 전용 — 각 기능 이슈에서 Guest 지원 시 optionalAuth로 전환
// users #17, reports #16
app.use('/api/users', memberAuth, userRoutes);
app.use('/api/reports', memberAuth, reportRoutes);

// Socket.io
setupSocket(io);
app.set('io', io); // 라우트에서 소켓 방 정리용 (예: 1:1 방 나가기)
startGuestCleanup(io); // 만료 Guest 소켓·Redis 항목 30초마다 정리 (#12)

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Orbit server running on port ${PORT}`);
});

// Redis가 없으면 Guest 기능만 503, 회원 기능은 계속 동작
// 연결되면 이전 실행의 온라인 상태를 비운다 (단일 서버 MVP, #13)
connectRedis()
  .then(() => console.log('Redis connected'))
  .then(resetOnline)
  .catch((err) => console.error('Redis 연결 실패 — Guest 기능 사용 불가:', err.message));

module.exports = { app, server };
