import React, { useState, useRef, useEffect } from 'react';

const emojiCategories = {
  'Smileys & People': [
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
    '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
    '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
    '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
    '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬',
    '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗',
    '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯',
    '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐'
  ],
  'Animals & Nature': [
    '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
    '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒',
    '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇',
    '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜',
    '🦟', '🦗', '🕷️', '🕸️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕',
    '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳',
    '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛'
  ],
  'Food & Drink': [
    '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈',
    '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦',
    '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔',
    '🍠', '🥐', '🥖', '🍞', '🥨', '🥯', '🧀', '🥚', '🍳', '🧈',
    '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟',
    '🍕', '🫓', '🥙', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🍝',
    '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚'
  ],
  'Activities': [
    '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱',
    '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳',
    '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸️',
    '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '⛹️', '🤺',
    '🏇', '🧘', '🏄', '🏊', '🤽', '🚣', '🧗', '🚵', '🚴', '🏆',
    '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️', '🎗️', '🎫', '🎟️', '🎪'
  ],
  'Travel & Places': [
    '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐',
    '🛻', '🚚', '🚛', '🚜', '🏍️', '🛵', '🚲', '🛴', '🛹', '🛼',
    '🚁', '🛸', '✈️', '🛩️', '🛫', '🛬', '🪂', '💺', '🚀', '🛰️',
    '🚊', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚉', '🚞',
    '🚋', '🚃', '🚟', '🚠', '🚡', '⛴️', '🛥️', '🚤', '⛵', '🛶',
    '🚢', '⚓', '⛽', '🚧', '🚨', '🚥', '🚦', '🛑', '🚏', '🗺️'
  ],
  'Objects': [
    '⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️',
    '🗜️', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥',
    '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️',
    '🎛️', '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋',
    '🔌', '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴',
    '💶', '💷', '💰', '💳', '💎', '⚖️', '🧰', '🔧', '🔨', '⚒️'
  ],
  'Symbols': [
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
    '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️',
    '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐',
    '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐',
    '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳',
    '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️'
  ]
};

const recentEmojis = ['😀', '😂', '❤️', '😍', '👍', '😊', '🔥', '💯', '😎', '🎉'];

export default function EmojiPicker({ onEmojiSelect, onClose }) {
  const [activeCategory, setActiveCategory] = useState('Smileys & People');
  const [searchQuery, setSearchQuery] = useState('');
  const pickerRef = useRef(null);

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleEmojiClick = (emoji) => {
    onEmojiSelect(emoji);
    
    // Add to recent emojis (in a real app, you'd store this in localStorage)
    const recent = JSON.parse(localStorage.getItem('recentEmojis') || '[]');
    const newRecent = [emoji, ...recent.filter(e => e !== emoji)].slice(0, 10);
    localStorage.setItem('recentEmojis', JSON.stringify(newRecent));
  };

  const getFilteredEmojis = () => {
    if (!searchQuery) {
      return emojiCategories[activeCategory] || [];
    }

    // Simple search - in a real app, you'd have emoji names/keywords
    const allEmojis = Object.values(emojiCategories).flat();
    return allEmojis.filter(emoji => {
      // This is a simplified search - you'd typically have emoji names/keywords
      return true; // For now, return all emojis when searching
    });
  };

  const getRecentEmojis = () => {
    try {
      return JSON.parse(localStorage.getItem('recentEmojis') || '[]');
    } catch {
      return recentEmojis;
    }
  };

  return (
    <div ref={pickerRef} className="emoji-picker">
      <div className="emoji-picker-header">
        <input
          type="text"
          placeholder="Search emojis..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="emoji-search"
        />
        <button className="emoji-close" onClick={onClose}>×</button>
      </div>

      {!searchQuery && (
        <div className="emoji-categories">
          {getRecentEmojis().length > 0 && (
            <button
              className={`category-btn ${activeCategory === 'Recent' ? 'active' : ''}`}
              onClick={() => setActiveCategory('Recent')}
              title="Recent"
            >
              🕒
            </button>
          )}
          <button
            className={`category-btn ${activeCategory === 'Smileys & People' ? 'active' : ''}`}
            onClick={() => setActiveCategory('Smileys & People')}
            title="Smileys & People"
          >
            😀
          </button>
          <button
            className={`category-btn ${activeCategory === 'Animals & Nature' ? 'active' : ''}`}
            onClick={() => setActiveCategory('Animals & Nature')}
            title="Animals & Nature"
          >
            🐶
          </button>
          <button
            className={`category-btn ${activeCategory === 'Food & Drink' ? 'active' : ''}`}
            onClick={() => setActiveCategory('Food & Drink')}
            title="Food & Drink"
          >
            🍎
          </button>
          <button
            className={`category-btn ${activeCategory === 'Activities' ? 'active' : ''}`}
            onClick={() => setActiveCategory('Activities')}
            title="Activities"
          >
            ⚽
          </button>
          <button
            className={`category-btn ${activeCategory === 'Travel & Places' ? 'active' : ''}`}
            onClick={() => setActiveCategory('Travel & Places')}
            title="Travel & Places"
          >
            🚗
          </button>
          <button
            className={`category-btn ${activeCategory === 'Objects' ? 'active' : ''}`}
            onClick={() => setActiveCategory('Objects')}
            title="Objects"
          >
            ⌚
          </button>
          <button
            className={`category-btn ${activeCategory === 'Symbols' ? 'active' : ''}`}
            onClick={() => setActiveCategory('Symbols')}
            title="Symbols"
          >
            ❤️
          </button>
        </div>
      )}

      <div className="emoji-grid">
        {searchQuery ? (
          getFilteredEmojis().map((emoji, index) => (
            <button
              key={index}
              className="emoji-btn"
              onClick={() => handleEmojiClick(emoji)}
              title={emoji}
            >
              {emoji}
            </button>
          ))
        ) : activeCategory === 'Recent' ? (
          getRecentEmojis().map((emoji, index) => (
            <button
              key={index}
              className="emoji-btn"
              onClick={() => handleEmojiClick(emoji)}
              title={emoji}
            >
              {emoji}
            </button>
          ))
        ) : (
          getFilteredEmojis().map((emoji, index) => (
            <button
              key={index}
              className="emoji-btn"
              onClick={() => handleEmojiClick(emoji)}
              title={emoji}
            >
              {emoji}
            </button>
          ))
        )}
      </div>

      {searchQuery && getFilteredEmojis().length === 0 && (
        <div className="emoji-no-results">
          No emojis found
        </div>
      )}
    </div>
  );
}
