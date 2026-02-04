// 20+ ASCII art avatar templates for bot profiles
// Each avatar is a string array (lines) to maintain formatting

export const ASCII_AVATARS: string[] = [
  // 1. Classic smiley
  `   ___
  (o o)
  ( V )
   |||`,

  // 2. Owl eyes
  `  (o_o)
  /(|)\\
   / \\`,

  // 3. Happy bot
  `  [^_^]
  |[o]|
   ||`,

  // 4. Penguin
  ` <('.')>
  /|  |\\
   ||`,

  // 5. Confused
  `  {°_°}
  /|   |\\
   ||`,

  // 6. Cat face
  ` /\\_/\\
 ( o.o )
  > ^ <`,

  // 7. Robot head
  ` +---+
 |o_o|
 |___|`,

  // 8. Bear
  ` (\\__/)
 (o^.^)
 z(___)`,

  // 9. Ghost
  `  .--.
 | oo |
  \\~~/
  ||||`,

  // 10. Alien
  `  /\\
 {o_o}
 /)_|\\
   ||`,

  // 11. Skull
  `  ___
 /o o\\
 \\_-_/`,

  // 12. TV head
  ` .---.
 |:_:|
 '---'`,

  // 13. Frog
  `  @..@
 (----)
( >  < )`,

  // 14. Bunny
  ` (\\(\\
 ( -.-)
 o_(")(")`,

  // 15. Flower
  `  @@@
 @(.)@
  \\|/`,

  // 16. Fish
  ` ><((°>
   ><>`,

  // 17. Star bot
  `  \\*/
 -(-)-
  /|\\`,

  // 18. Crab
  ` (\\/)
(o.O)
 /|\\`,

  // 19. Wizard
  `   /\\
  /  \\
 | °° |
  \\__/`,

  // 20. Ninja
  `  ___
 |___|
  \\-/`,

  // 21. Moon face
  `  _____
 /     \\
| o   o |
 \\_____/`,

  // 22. Cyclops
  `  .--.
 ( O  )
  '--'`,

  // 23. Cool shades
  ` ______
|[====]|
  \\__/`,

  // 24. Heart eyes
  `  ___
 (♥_♥)
  \\_/`,

  // 25. Monacle
  `  .--.
 |O   |
  '--'`,

  // 26. Pixel face
  ` █▀▀█
 █ ▀▄█
 █▄▄▀█`,

  // 27. Triangle bot
  `   /\\
  /oo\\
 /____\\`,

  // 28. Cube
  `  ____
 |    |
 |_oo_|`,

  // 29. Speaker
  ` ((o))
  ||||
  ||||`,

  // 30. Bat
  `/\\ /\\
 (o.o)
  \\-/`,
];

/**
 * Get avatar by index (cycles if index > length)
 */
export function getAvatarByIndex(index: number): string {
  return ASCII_AVATARS[index % ASCII_AVATARS.length];
}

/**
 * Get a deterministic avatar based on bot ID hash
 */
export function getAvatarForBotId(botId: string): string {
  let hash = 0;
  for (let i = 0; i < botId.length; i++) {
    const char = botId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return getAvatarByIndex(Math.abs(hash));
}

/**
 * Get a random avatar
 */
export function getRandomAvatar(): string {
  return ASCII_AVATARS[Math.floor(Math.random() * ASCII_AVATARS.length)];
}
