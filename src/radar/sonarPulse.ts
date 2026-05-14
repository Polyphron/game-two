export type SonarPulse = {
  age: number;
  duration: number;
  radius: number;
  reveal: number;
  speed: number;
};

export function createSonarPulse(): SonarPulse {
  return {
    age: Number.POSITIVE_INFINITY,
    duration: 2.6,
    radius: 0,
    reveal: 0,
    speed: 155,
  };
}

export function triggerSonarPulse(sonar: SonarPulse): void {
  sonar.age = 0;
  sonar.radius = 0;
  sonar.reveal = 1;
}

export function updateSonarPulse(sonar: SonarPulse, deltaSeconds: number): void {
  if (sonar.reveal <= 0) {
    return;
  }

  sonar.age += Math.max(0, deltaSeconds);
  sonar.radius = sonar.age * sonar.speed;
  sonar.reveal = Math.max(0, 1 - sonar.age / sonar.duration);
}
