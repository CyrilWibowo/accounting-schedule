// App.tsx
import React, { useState } from 'react';
import AppLayout from './components/Layout/AppLayout';
import { View } from './components/Layout/Sidebar';
import './App.css';

function App() {
  const [currentView, setCurrentView] = useState<View>('home');

  return (
    <div className="App">
      <AppLayout currentView={currentView} onNavigate={setCurrentView} />
    </div>
  );
}

export default App;
