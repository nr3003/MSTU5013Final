import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.8/firebase-app.js";
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.6.8/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/9.6.8/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCU7qlYpkc9RxZPdjYuwTAwHQBw0HKnnCg",
  authDomain: "mstu5013-workout-tracker.firebaseapp.com",
  projectId: "mstu5013-workout-tracker",
  storageBucket: "mstu5013-workout-tracker.appspot.com",
  messagingSenderId: "1069688157733",
  appId: "1:1069688157733:web:6ef756af29c943cad671cc"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const workoutsRef = collection(db, "workouts");

const { createApp } = Vue;

createApp({
  data() {
    const getLocalDateStr = () => {
      const today = new Date();
      return today.getFullYear() + '-' +
        String(today.getMonth() + 1).padStart(2, '0') + '-' +
        String(today.getDate()).padStart(2, '0');
    };

    return {
      currentPage: 'newHome',
      today: new Date(),
      authUser: null,
      user: {
        name: "",
        age: "",
        sleepHours: "",
        standHours: "",
        steps: "",
        workoutGoal: "",
        caloriesConsumed: 0
      },
      newWorkout: {
        type: "",
        name: "",
        duration: null,
        calories: null,
        date: getLocalDateStr()
      },
      workouts: [],
    };
  },

  computed: {
    weekDays() {
      const days = [];
      const today = new Date();

      for (let i = -3; i <= 3; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);

        const dateStr = date.getFullYear() + '-' +
          String(date.getMonth() + 1).padStart(2, '0') + '-' +
          String(date.getDate()).padStart(2, '0');

        const hasWorkout = this.workouts.some(workout =>
          this.normalizeDateStr(workout.date) === dateStr
        );

        days.push({
          date: dateStr,
          label: date.getDate(),
          name: date.toLocaleDateString("en-US", { weekday: "short" }),
          isToday: date.toDateString() === today.toDateString(),
          completed: hasWorkout
        });
      }

      return days;
    },

    thrivingPercentage() {
      if (!this.user.workoutGoal || this.user.workoutGoal <= 0) return 0;
      const percent = Math.round((this.user.caloriesConsumed / this.user.workoutGoal) * 100);
      return Math.min(percent, 100);
    }
  },

  methods: {
    navigateTo(page) {
      this.currentPage = page;
    },

    normalizeDateStr(date) {
      if (!date) return null;
      if (typeof date === "string") return date;

      try {
        const d = date.toDate ? date.toDate() : new Date(date);
        return d.getFullYear() + '-' +
          String(d.getMonth() + 1).padStart(2, '0') + '-' +
          String(d.getDate()).padStart(2, '0');
      } catch {
        return null;
      }
    },

    formatDate(date) {
      if (!date) return "";

      try {
        let jsDate;

        if (typeof date === "string") {
          const [year, month, day] = date.split("-");
          jsDate = new Date(Number(year), Number(month) - 1, Number(day));
        } else if (date.toDate) {
          jsDate = date.toDate();
        } else {
          jsDate = new Date(date);
        }

        return jsDate.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric"
        });
      } catch (e) {
        console.error("Error formatting date:", e);
        return "Invalid date";
      }
    },

    async addWorkout() {
      if (!this.newWorkout.type || !this.newWorkout.duration || !this.newWorkout.calories) {
        console.warn("Missing required workout fields.");
        return;
      }

      try {
        const docRef = await addDoc(workoutsRef, this.newWorkout);
        this.user.caloriesConsumed += this.newWorkout.calories;
        await this.saveProfile();
        await this.loadWorkouts();

        const getLocalDateStr = () => {
          const today = new Date();
          return today.getFullYear() + '-' +
            String(today.getMonth() + 1).padStart(2, '0') + '-' +
            String(today.getDate()).padStart(2, '0');
        };

        this.newWorkout = {
          type: "",
          name: "",
          duration: null,
          calories: null,
          date: getLocalDateStr()
        };
      } catch (error) {
        console.error("Error adding workout:", error);
      }
    },

    async deleteWorkout(id) {
      try {
        const workout = this.workouts.find(w => w.id === id);
        await deleteDoc(doc(db, "workouts", id));

        if (workout && workout.calories) {
          this.user.caloriesConsumed = Math.max(0, this.user.caloriesConsumed - workout.calories);
          await this.saveProfile();
        }

        await this.loadWorkouts();
      } catch (error) {
        console.error("Error deleting workout:", error);
      }
    },

    async loadWorkouts() {
      try {
        const querySnapshot = await getDocs(workoutsRef);
        this.workouts = [];
        querySnapshot.forEach((doc) => {
          this.workouts.push({
            id: doc.id,
            ...doc.data()
          });
        });
      } catch (error) {
        console.error("Error loading workouts:", error);
      }
    },

    async saveProfile() {
      if (!this.user.name) {
        console.warn("Name is required to save profile.");
        return;
      }

      try {
        const userRef = doc(db, "users", this.user.name);
        await setDoc(userRef, this.user);
      } catch (err) {
        console.error("Error saving profile:", err);
      }
    },

    async loadUserProfile() {
      if (!this.authUser) return;

      try {
        const docSnap = await getDoc(doc(db, "users", this.authUser.uid));
        if (docSnap.exists()) {
          this.user = docSnap.data();
        }
      } catch (error) {
        console.error("Error loading profile:", error);
      }
    },

    async initAuth() {
      try {
        const userCredential = await signInAnonymously(auth);
        this.authUser = userCredential.user;
        await this.loadUserProfile();
        await this.loadWorkouts();
      } catch (error) {
        console.error("Authentication error:", error);
      }
    }
  },

  async mounted() {
    await this.initAuth();

    onAuthStateChanged(auth, (user) => {
      if (user) {
        this.authUser = user;
        this.loadUserProfile();
        this.loadWorkouts();
      }
    });
  }
}).mount("#app");