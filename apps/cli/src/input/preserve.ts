export type InputSetter = (value: string) => void;

export function preserveInputAfterCurrentKeypress(value: string, setInput: InputSetter): void {
  // woc 这啥😨比 Promise 的方法更浅显 + 不易出错😨
  queueMicrotask(() => {
    setInput(value);
  });
}
