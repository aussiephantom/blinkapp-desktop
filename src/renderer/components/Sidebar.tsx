import React from 'react';

interface SidebarProps {
  activeTab: 'processor' | 'queue' | 'settings';
  onTabChange: (tab: 'processor' | 'queue' | 'settings') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const menuItems = [
    {
      id: 'processor' as const,
      label: 'File Processor',
      icon: '📁',
      description: 'Process and tag files'
    },
    {
      id: 'queue' as const,
      label: 'Processing Queue',
      icon: '⏳',
      description: 'View processing status'
    },
    {
      id: 'settings' as const,
      label: 'Settings',
      icon: '⚙️',
      description: 'Configure preferences'
    }
  ];

  return (
    <nav className="sidebar">
      {menuItems.map((item) => (
        <div
          key={item.id}
          className={`sidebar-item ${activeTab === item.id ? 'active' : ''}`}
          onClick={() => onTabChange(item.id)}
          title={item.description}
        >
          <div className="sidebar-item-icon">
            {item.icon}
          </div>
          <span>{item.label}</span>
        </div>
      ))}
    </nav>
  );
};
