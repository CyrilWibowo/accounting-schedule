// App.tsx
import React, { useState } from 'react';
import HomeScreen from './components/HomeScreen';
import LeaseDashboard from './components/LeaseDashboard';
import './App.css';

type View = 'home' | 'leases';

function App() {
  const [currentView, setCurrentView] = useState<View>('home');

  return (
    <div className="App">
      {currentView === 'home' && (
        <HomeScreen onNavigateToLeases={() => setCurrentView('leases')} />
      )}
      {currentView === 'leases' && (
        <LeaseDashboard onBack={() => setCurrentView('home')} />
      )}
    </div>
  );
}

export default App;
