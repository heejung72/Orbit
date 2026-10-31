import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import config from '../config';

const SOCKET_URL = config.SOCKET_URL;

let socket = null;

export async function connectSocket() {
  const token = await AsyncStorage.getItem('token');
  if (!token) return null;

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
  });

  socket.on('connect', () => console.log('Socket connected'));
  socket.on('disconnect', () => console.log('Socket disconnected'));

  return socket;
}

export function getSocket() {
  return socket;
}

export function joinRoom(roomId) {
  if (socket) socket.emit('join_room', roomId);
}

export function leaveRoom(roomId) {
  if (socket) socket.emit('leave_room', roomId);
}

export function sendMessage(roomId, content, type = 'text') {
  if (socket) socket.emit('send_message', { roomId, content, type });
}

export function onNewMessage(callback) {
  if (socket) socket.on('new_message', callback);
}

export function offNewMessage(callback) {
  if (socket) socket.off('new_message', callback);
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
