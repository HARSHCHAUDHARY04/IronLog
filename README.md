# IronLog 🏋️‍♂️

IronLog is a comprehensive, modern fitness and workout tracking application built with React Native (Expo). Designed for gym-goers, athletes, and fitness enthusiasts, it provides advanced tools to track workouts, measure progress, and achieve fitness goals through intelligent tracking and analytics.

## 🚀 Features

*   **Intelligent Workout Tracking**: Log sets, reps, weights, and rest times easily during your active workout sessions.
*   **Progressive Overload Engine**: Built-in logic (`overloadEngine.ts`) to ensure you are constantly challenging yourself and progressing over time.
*   **PR Detection**: Automatically detects and celebrates your Personal Records (PRs) across various exercises (`prDetection.ts`).
*   **Comprehensive Analytics & History**: Visualize your fitness journey with detailed analytics and a complete history of past workouts.
*   **AI Coach**: Get personalized recommendations and guidance for your workouts.
*   **Authentication & Cloud Sync**: Secure login and signup powered by Supabase, ensuring your data is safely backed up and synced across devices.
*   **Offline Support**: Robust local storage implementation (`storage.ts`) ensures your workouts are saved even without an internet connection.
*   **Modern UI/UX**: Built with React Native, featuring smooth animations (`react-native-reanimated`), gesture handling, and a sleek, customizable theme.

## 🛠️ Tech Stack

*   **Framework**: React Native with [Expo](https://expo.dev/) (Expo Router for navigation)
*   **Language**: TypeScript
*   **State Management**: [Zustand](https://github.com/pmndrs/zustand)
*   **Backend & Database**: [Supabase](https://supabase.com/) (PostgreSQL, Auth)
*   **Local Storage**: Async Storage
*   **Styling & UI**: Expo Vector Icons, Bottom Sheet, FlashList
*   **Animations**: React Native Reanimated

## 📂 Project Structure

*   `/app`: Contains all the screens and routing logic (Auth screens, Tabs like Workout, History, Analytics, Profile, and AI Coach).
*   `/components`: Reusable UI components.
*   `/lib`: Core business logic, including the Overload Engine, PR Detection, Supabase client setup, and local storage utilities.
*   `/stores`: Zustand stores for global state management (`authStore.ts`, `workoutStore.ts`).
*   `/data`: Static data, such as the initial exercises database (`exercises.json`).

## 🚀 Getting Started

### Prerequisites

*   Node.js installed on your machine
*   Expo CLI (`npm install -g expo-cli`)
*   Supabase account (for backend services)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/HARSHCHAUDHARY04/IronLog.git
    cd IronLog
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Environment Setup:**
    Create a `.env` file in the root directory and add your Supabase credentials:
    ```env
    EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
    EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```

4.  **Run the app:**
    ```bash
    npm start
    ```
    *Press `a` to open on Android emulator, `i` for iOS simulator, or scan the QR code with the Expo Go app on your physical device.*

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

## 📄 License

This project is open-source and available under the standard open-source license.
