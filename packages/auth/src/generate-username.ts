const adjectives = [
  "Silent",
  "Swift",
  "Crimson",
  "Golden",
  "Shadow",
  "Cosmic",
  "Rapid",
  "Noble",
  "Mystic",
  "Electric",
  "Lucky",
  "Frosty",
  "Velvet",
  "Bright",
  "Atomic",
  "Binary",
  "Quantum",
  "Turbo",
  "Neon",
  "Iron",
];

const nouns = [
  "Wolf",
  "Falcon",
  "Tiger",
  "Fox",
  "Raven",
  "Bear",
  "Lion",
  "Panda",
  "Otter",
  "Shark",
  "Phoenix",
  "Comet",
  "Meteor",
  "Byte",
  "Kernel",
  "Stack",
  "Pixel",
  "Cobra",
  "Jaguar",
  "Eagle",
];

export function generateUsername(): string {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const digits = Math.floor(1000 + Math.random() * 9000);

  return `${adjective}${noun}${digits}`;
}
