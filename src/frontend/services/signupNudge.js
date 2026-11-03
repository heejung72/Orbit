// 가입 유도 모달 열기 (#14) — 모달은 App이 그리고, 화면(채팅방의 "대화 저장하기" 등)은 이 함수만 부른다
// api.js의 setOnSessionExpired와 같은 방식: App이 시작할 때 handler를 등록
let handler = null;
export const setSignupNudgeHandler = (fn) => {
  handler = fn;
};
// reason: 'save'(대화 저장하기) | 'warning'(만료 5분 전, remainingSec) | 'messages'(메시지 20개)
export const openSignupNudge = (reason, extra = {}) => handler?.({ reason, ...extra });
