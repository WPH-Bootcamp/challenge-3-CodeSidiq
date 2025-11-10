// ============================================
// HABIT TRACKER CLI - CHALLENGE 3
// ============================================
// NAMA: Sidiq Kusumah
// KELAS: WPH-REP
// TANGGAL: 5 November 2025
// ============================================

// Import modules
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Konstanta
const DATA_FILE = path.join(__dirname, 'habits-data.json');
const REMINDER_INTERVAL = 10000; // 10 detik
const DAYS_IN_WEEK = 7;

// Helper format tanggal
const fmtDate = (d) =>
  new Date(d).toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

const fmtDateTime = (d) =>
  new Date(d).toLocaleString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

// Setup readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// ========================
// USER PROFILE OBJECT
// ========================
const userProfile = {
  name: 'Sidiq',
  joinDate: new Date(),
  totalHabits: 0,
  completedThisWeek: 0,

  updateStats(habits) {
    this.totalHabits = habits.length;
    this.completedThisWeek = habits.reduce(
      (sum, h) => sum + h.getThisWeekCompletions(),
      0
    );
  },

  getDaysJoined() {
    const diff = Date.now() - new Date(this.joinDate).getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  },
};

// ========================
// HABIT CLASS
// ========================
class Habit {
  constructor({ id, name, targetFrequency, completions, createdAt }) {
    this.id = id ?? Date.now().toString();
    this.name = name ?? 'Unnamed Habit';
    const tf = Number(targetFrequency ?? 7);
    this.targetFrequency = Number.isNaN(tf)
      ? 7
      : Math.min(Math.max(tf, 1), DAYS_IN_WEEK);
    this.completions = Array.isArray(completions) ? completions : [];
    this.createdAt = createdAt ?? new Date().toISOString();
  }

  markComplete() {
    const today = new Date().toISOString().split('T')[0];
    if (!this.completions.includes(today)) {
      this.completions.push(today);
    }
  }

  getThisWeekCompletions() {
    const start = this.getStartOfWeek(new Date());
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    return this.completions.filter((d) => {
      const c = new Date(d);
      return c >= start && c < end;
    }).length;
  }

  isCompletedThisWeek() {
    return this.getThisWeekCompletions() >= this.targetFrequency;
  }

  getProgressPercentage() {
    const done = this.getThisWeekCompletions();
    const pct = Math.min(100, Math.round((done / this.targetFrequency) * 100));
    return { done, pct };
  }

  getStatus() {
    return this.isCompletedThisWeek() ? 'Selesai' : 'Aktif';
  }

  getStartOfWeek(date) {
    const d = new Date(date);
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  }
}

// ========================
// HABIT TRACKER CLASS
// ========================
class HabitTracker {
  constructor(profile) {
    this.profile = profile;
    this.habits = [];
    this._timer = null;
    this._reminderIndex = 0; // penunjuk giliran reminder
  }

  // CRUD
  addHabit(name, freq) {
    const n = Number(freq);
    if (!name || Number.isNaN(n) || n < 1 || n > DAYS_IN_WEEK) {
      throw new Error('Nama dan target per minggu harus valid (1-7).');
    }
    const habit = new Habit({ name, targetFrequency: n });
    this.habits.push(habit);
    this.saveToFile();
    this.profile.updateStats(this.habits);
    this._reminderIndex = 0;
  }

  completeHabit(index) {
    const i = Number(index) - 1;
    if (!Number.isInteger(i) || i < 0 || i >= this.habits.length) {
      throw new Error('Index habit tidak valid.');
    }
    const habit = this.habits[i];
    habit.markComplete();
    this.saveToFile();
    this.profile.updateStats(this.habits);
  }

  deleteHabit(index) {
    const i = Number(index) - 1;
    if (!Number.isInteger(i) || i < 0 || i >= this.habits.length) {
      throw new Error('Index habit tidak valid.');
    }
    const [removed] = this.habits.splice(i, 1);
    this.saveToFile();
    this.profile.updateStats(this.habits);
    return removed?.name ?? '(terhapus)';
    this._reminderIndex = 0;
  }

  // Display
  displayProfile() {
    this.profile.updateStats(this.habits);
    console.log('==================================================');
    console.log('PROFIL PENGGUNA');
    console.log('==================================================');
    console.log(`Nama             : ${this.profile.name}`);
    console.log(`Hari Bergabung   : ${this.profile.getDaysJoined()}`);
    console.log(`Bergabung sejak  : ${fmtDate(this.profile.joinDate)}`);
    console.log(`Jumlah Kebiasaan : ${this.profile.totalHabits}`);
    console.log(`Selesai Minggu Ini: ${this.profile.completedThisWeek}`);
    console.log('==================================================');
  }

  displayHabits(filter = 'all') {
    // salin array agar aman dari mutasi langsung
    let list = this.habits.slice();

    // filter sesuai pilihan menu
    if (filter === 'active')
      list = list.filter((h) => !h.isCompletedThisWeek());
    else if (filter === 'done')
      list = list.filter((h) => h.isCompletedThisWeek());

    // urutkan: aktif dulu, lalu selesai, dan berdasarkan tanggal dibuat (lama → baru)
    list.sort((a, b) => {
      const sa = a.isCompletedThisWeek() ? 1 : 0; // selesai → 1
      const sb = b.isCompletedThisWeek() ? 1 : 0;
      if (sa !== sb) return sa - sb; // aktif (0) muncul dulu
      return new Date(a.createdAt) - new Date(b.createdAt); // tanggal lama duluan
    });

    // jika kosong
    if (!list.length) return console.log('(Tidak ada kebiasaan)');

    // tampilkan tiap habit
    list.forEach((h, i) => {
      const { done, pct } = h.getProgressPercentage();
      const bar = '█'.repeat(Math.round(pct / 10)).padEnd(10, '░');
      console.log(`${i + 1}. [${h.getStatus()}] ${h.name}`);
      console.log(`   Dibuat   : ${fmtDate(h.createdAt)}`);
      console.log(`   Progress : ${done}/${h.targetFrequency} (${pct}%)`);
      console.log(`   ${bar} ${pct}%\n`);
    });
  }

  displayHabitsWithWhile() {
    let i = 0;
    console.log('=== WHILE LOOP DEMO ===');
    while (i < this.habits.length) {
      console.log(this.habits[i].name);
      i++;
    }
  }

  displayHabitsWithFor() {
    console.log('=== FOR LOOP DEMO ===');
    for (let i = 0; i < this.habits.length; i++) {
      console.log(this.habits[i].name);
    }
  }

  displayStats() {
    const total = this.habits.length;
    const selesai = this.habits.filter((h) => h.isCompletedThisWeek()).length;
    const aktif = total - selesai;
    const rata2Progress =
      total === 0
        ? 0
        : Math.round(
            this.habits
              .map((h) => h.getProgressPercentage().pct)
              .reduce((a, b) => a + b, 0) / total
          );

    console.log('==================================================');
    console.log('STATISTIK');
    console.log('==================================================');
    console.log(`Total Habit : ${total}`);
    console.log(`Aktif       : ${aktif}`);
    console.log(`Selesai     : ${selesai}`);
    console.log(`Rata-rata Progres: ${rata2Progress}%`);
    console.log('==================================================');
  }

  // Reminder
  startReminder() {
    if (this._timer) return;
    this.showReminder(); // tembak sekali langsung, jangan nunggu 10 detik
    this._timer = setInterval(() => this.showReminder(), REMINDER_INTERVAL);
  }

  showReminder() {
    if (IS_SHUTTING_DOWN) return;

    // Ambil semua habit yang masih aktif (belum capai target minggu ini)
    const active = this.habits.filter((h) => !h.isCompletedThisWeek());
    if (active.length === 0) return;

    // Pilih target secara round-robin
    const idx = this._reminderIndex % active.length;
    const target = active[idx];
    this._reminderIndex += 1;

    // Tampilkan reminder
    process.stdout.write('\n');
    console.log('==================================================');
    console.log(`REMINDER: Jangan lupa "${target.name}"!`);
    console.log('==================================================');

    // Pulihkan prompt jika sedang input
    if (IS_PROMPTING && LAST_PROMPT) {
      process.stdout.write(LAST_PROMPT);
    }
  }

  stopReminder() {
    clearInterval(this._timer);
    this._timer = null;
  }

  // File handling
  saveToFile() {
    const data = {
      profile: { name: this.profile.name, joinDate: this.profile.joinDate },
      habits: this.habits,
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  }

  loadFromFile() {
    if (!fs.existsSync(DATA_FILE)) return;

    let raw = '';
    try {
      raw = fs.readFileSync(DATA_FILE, 'utf8');
    } catch (e) {
      console.error('[WARN] Gagal membaca file data:', e.message);
      return;
    }

    if (!raw || !raw.trim()) {
      // file kosong, biarkan app jalan tanpa data
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error(
        '[WARN] File data rusak. Abaikan lalu jalankan ulang untuk membuat data baru.'
      );
      return;
    }

    // Gunakan nullish coalescing agar aman bila key hilang
    this.profile.name = parsed.profile?.name ?? this.profile.name;
    this.profile.joinDate = parsed.profile?.joinDate ?? this.profile.joinDate;

    const list = Array.isArray(parsed.habits) ? parsed.habits : [];
    this.habits = list.map((h) => new Habit(h));
    this.profile.updateStats(this.habits);
  }

  clearAllData() {
    this.habits = [];
    if (fs.existsSync(DATA_FILE)) fs.unlinkSync(DATA_FILE);
  }
}

// ========================
// HELPER FUNCTIONS
// ========================
// Flag untuk menahan reminder saat sedang input di CLI
let IS_PROMPTING = false;
let IS_SHUTTING_DOWN = false; // <— baru
let LAST_PROMPT = ''; // kalau kamu sudah tambah sebelumnya

const askQuestion = (q) =>
  new Promise((resolve) => {
    LAST_PROMPT = q; // simpan pertanyaan terakhir
    IS_PROMPTING = true;
    rl.question(q, (ans) => {
      IS_PROMPTING = false;
      resolve(ans.trim());
    });
  });

const displayMenu = () => {
  console.log(`
==================================================
HABIT TRACKER - MAIN MENU
${fmtDateTime(new Date())}
==================================================
1. Lihat Profil
2. Lihat Semua Kebiasaan
3. Lihat Kebiasaan Aktif
4. Lihat Kebiasaan Selesai
5. Tambah Kebiasaan Baru
6. Tandai Kebiasaan Selesai
7. Hapus Kebiasaan
8. Lihat Statistik
9. Demo Loop (while/for)
0. Keluar
==================================================
`);
};

// ========================
// MAIN FUNCTION
// ========================
const handleMenu = async (tracker) => {
  tracker.startReminder();

  while (true) {
    displayMenu();
    const choice = await askQuestion('Pilih menu [0-9]: ');

    try {
      switch (choice) {
        case '1':
          tracker.displayProfile();
          break;
        case '2':
          tracker.displayHabits('all');
          break;
        case '3':
          tracker.displayHabits('active');
          break;
        case '4':
          tracker.displayHabits('done');
          break;
        case '5': {
          const name = await askQuestion('Nama kebiasaan: ');
          const freq = await askQuestion('Target per minggu (1-7): ');
          tracker.addHabit(name, freq);
          break;
        }
        case '6': {
          tracker.displayHabits('all');
          const idxStr = await askQuestion('Nomor habit yang selesai (1..N): ');
          if (!idxStr) {
            console.log('Dibatalkan.');
            break;
          }
          tracker.completeHabit(Number(idxStr));
          console.log('✓ Ditandai selesai.'); // feedback singkat
          tracker.displayHabits('done'); // langsung tampilkan yang selesai
          break;
        }

        case '7': {
          tracker.displayHabits('all');
          const idxStr = await askQuestion('Nomor habit yang dihapus (1..N): ');
          if (!idxStr) {
            console.log('Dibatalkan.');
            break;
          }
          const yakin = await askQuestion('Yakin hapus? (y/N): ');
          if (yakin.toLowerCase() !== 'y') {
            console.log('Dibatalkan.');
            break;
          }
          tracker.deleteHabit(Number(idxStr));
          console.log('✓ Terhapus.');
          break;
        }

        case '8':
          tracker.displayStats();
          break;
        case '9':
          tracker.displayHabitsWithWhile();
          tracker.displayHabitsWithFor();
          break;
        case '0':
          IS_SHUTTING_DOWN = true; // <— tambah
          tracker.stopReminder(); // matikan interval
          console.log('Keluar dari aplikasi...');
          rl.close();
          return;

        default:
          console.log('Pilihan tidak valid');
      }
    } catch (err) {
      console.error('[ERROR]', err.message);
    }
  }
};

const main = async () => {
  console.clear();
  console.log('==================================================');
  console.log('HABIT TRACKER CLI');
  console.log(`Waktu saat ini : ${fmtDateTime(new Date())}`);
  console.log('==================================================');
  tracker = new HabitTracker(userProfile);
  tracker.loadFromFile();
  await handleMenu(tracker);
};

let tracker; // supaya bisa diakses dari SIGINT handler
main().catch((err) => {
  console.error('Fatal Error:', err.message);
  rl.close();
});

process.on('SIGINT', () => {
  console.log('\nMenutup aplikasi…');
  IS_SHUTTING_DOWN = true; // <— tambah
  try {
    tracker?.stopReminder();
  } catch {}
  rl.close();
  process.exit(0);
});
