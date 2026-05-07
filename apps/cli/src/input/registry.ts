import { useInput } from "ink";
import { exit } from "node:process";



export function factoryKeyboardShortcuts() {
  useInput((value, key) => {
    if (key.ctrl && value === 'c') {
      console.log('Ctrl+C')
      exit(0);
    }

  })
}