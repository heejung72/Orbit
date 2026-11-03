import { createNavigationContainerRef } from '@react-navigation/native';

// 화면 밖(App의 소켓 이벤트)에서 이동할 때 쓰는 내비게이션 참조 (#13)
export const navigationRef = createNavigationContainerRef();

// 1:1 채팅방 열기 — 이미 그 방을 보고 있으면 그대로 둔다
// (수락 응답과 match:accepted 이벤트가 둘 다 와도 방이 두 번 쌓이지 않게)
export function openChatRoom({ roomId, title }) {
  if (!navigationRef.isReady()) return;
  const current = navigationRef.getCurrentRoute();
  if (current?.name === 'ChatRoom' && current.params?.roomId === roomId) return;
  navigationRef.navigate('ChatRoom', { roomId, title, type: 'direct' });
}
