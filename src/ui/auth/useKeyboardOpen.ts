import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

/** Whether the on-screen keyboard is up. The one place the sign-in sheet listens for it. */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return open;
}
