export const BOTS_PER_TEAM = 20;

export const CFG = {
  player: {
    eye: 1.62,
    walk: 6.1,
    sprint: 9.3,
    adsSpeed: 0.55,
    jump: 7.4,
    gravity: 19.5,
    groundLambda: 11,
    airLambda: 2.2,
    sens: 0.0021,
    fov: 82, adsFov: 55, adsTime: 0.16,
    hp: 100, regenDelay: 6, regenRate: 25,
  },
  rifle: {
    fireMode: 'auto',
    rpm: 600, damage: 24,
    magSize: 30, reserve: 120,
    reloadTime: 2.3,
    range: 500,
    spreadHip: 0.55, spreadAds: 0.12,
    bloomPerShot: 0.16, bloomMax: 3.2, bloomRecover: 2.6,
    kickVert: 0.62, kickVertVar: 0.30,
    kickHoriz: 0.22,
    kickRecoverFrac: 0.30,
    kickRecoverSpeed: 9,
  },
  team: { eagle: 0x3f6fd1, raven: 0xd1483f },
  bot: {
    count: BOTS_PER_TEAM,        // per team — tune freely (5 for quick tests)
    hp: 100, skill: 0.45,        // 0..1 → accuracy/reaction/lead
    viewRange: 110, fovDeg: 135,
    speed: 5.4, sprintSpeed: 7.6,
    rpm: 450, damage: 13, burstMin: 4, burstMax: 9,
    respawnTime: 5, regenDelay: 6, regenRate: 18,
    thinkInterval: 0.25,
    retreatHp: 30, reengageHp: 60,
  },
  match: {
    captureTime: 10,                    // seconds for a solo cap
    capSpeeds: [0, 1, 1.5, 1.8, 2.0],   // multiplier by capturer count (1..4+)
    bleedInterval: 5,                   // seconds between ticket bleeds
    bleedPerPoint: 2,                   // tickets per point deficit per bleed
  },
  debug: { paths: false },       // true → draw waypoint graph
};
