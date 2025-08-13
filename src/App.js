import React, { useState, useEffect } from 'react';
import './styles/App.css';
import { getGuests, addGuest as addGuestToFirestore, updateGuestPayment as updatePaymentInFirestore } from './services/guestService';

function App() {
  const [currentView, setCurrentView] = useState('home');
  const [guests, setGuests] = useState([]);
  const [landlordView, setLandlordView] = useState('list');
  const [selectedGuest, setSelectedGuest] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load guests from Firestore on app start
  useEffect(() => {
    loadGuests();
  }, []);

  const loadGuests = async () => {
    setLoading(true);
    try {
      const guestsData = await getGuests();
      setGuests(guestsData);
      console.log('載入房客資料:', guestsData);
    } catch (error) {
      console.error('Error loading guests:', error);
      alert('載入房客資料失敗，請檢查網路連線');
    } finally {
      setLoading(false);
    }
  };

  // Add new guest to Firestore
  const addGuest = async (newGuestData) => {
    try {
      const newGuest = await addGuestToFirestore(newGuestData);
      setGuests(prevGuests => {
        const updatedGuests = [...prevGuests, newGuest];
        return updatedGuests.sort((a, b) => new Date(a.checkInDate) - new Date(b.checkInDate));
      });
      return newGuest;
    } catch (error) {
      console.error('Error adding guest:', error);
      throw error;
    }
  };

  // Update guest payment status in Firestore
  const updateGuestPayment = async (guestId, newStatus) => {
    try {
      await updatePaymentInFirestore(guestId, newStatus);
      setGuests(prevGuests => 
        prevGuests.map(guest => 
          guest.id === guestId ? { ...guest, paymentStatus: newStatus } : guest
        )
      );
    } catch (error) {
      console.error('Error updating payment:', error);
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="app">
        <div className="container">
          <div className="card">
            <div style={{textAlign: 'center', padding: '2rem'}}>
              <div style={{fontSize: '1.2rem', color: '#6b7280', marginBottom: '1rem'}}>
                正在載入房客資料...
              </div>
              <div style={{
                width: '40px',
                height: '40px',
                border: '4px solid #f3f4f6',
                borderTop: '4px solid #3b82f6',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto'
              }}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {currentView === 'home' && <HomePage setCurrentView={setCurrentView} />}
      {currentView === 'guest' && <GuestForm setCurrentView={setCurrentView} addGuest={addGuest} />}
      {currentView === 'landlord' && <LandlordLogin setCurrentView={setCurrentView} />}
      {currentView === 'guestList' && (
        <LandlordDashboard 
          guests={guests} 
          setCurrentView={setCurrentView}
          landlordView={landlordView}
          setLandlordView={setLandlordView}
          setSelectedGuest={setSelectedGuest}
          refreshGuests={loadGuests}
        />
      )}
      {currentView === 'guestDetail' && (
        <GuestDetail 
          guest={selectedGuest}
          setCurrentView={setCurrentView}
          landlordView={landlordView}
          updateGuestPayment={updateGuestPayment}
        />
      )}
    </div>
  );
}

// 首頁組件
function HomePage({ setCurrentView }) {
  return (
    <div className="container">
      <div className="card">
        <div className="card-header">
          <h1 className="card-title">RENTAL管理系統</h1>
          <p style={{textAlign: 'center', color: '#6b7280', fontSize: '0.9rem', marginTop: '0.5rem'}}>
            雲端數據存儲 | 即時同步
          </p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => setCurrentView('guest')}
        >
          入住登記
        </button>
        <button 
          className="btn btn-secondary"
          onClick={() => setCurrentView('landlord')}
        >
          房東管理
        </button>
      </div>
    </div>
  );
}

// 旅客表單組件 - 電話非必填版本
function GuestForm({ setCurrentView, addGuest }) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    checkInDate: '',
    checkOutDate: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    // 修改驗證邏輯：電話不再是必填欄位
    if (!formData.name || !formData.checkInDate || !formData.checkOutDate) {
      alert('請填寫所有必填欄位（姓名、入住日期、離開日期）');
      return;
    }

    // 檢查日期邏輯
    if (new Date(formData.checkOutDate) <= new Date(formData.checkInDate)) {
      alert('離開日期必須晚於入住日期');
      return;
    }

    setIsSubmitting(true);
    try {
      // 添加新房客到 Firestore
      await addGuest(formData);
      
      alert('登記成功！資料已保存至雲端');
      setCurrentView('home');
    } catch (error) {
      console.error('Error adding guest:', error);
      alert('登記失敗，請檢查網路連線並重試');
    }
    setIsSubmitting(false);
  };

  return (
    <div className="container">
      <div className="nav-header">
        <button className="nav-back" onClick={() => setCurrentView('home')}>
          ←
        </button>
        <h1 className="nav-title">旅客登記</h1>
        <div></div>
      </div>
      
      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">姓名 *</label>
            <input
              type="text"
              className="form-input"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="請輸入姓名"
              disabled={isSubmitting}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">電話</label>
            <input
              type="tel"
              className="form-input"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              placeholder="請輸入電話號碼（選填）"
              disabled={isSubmitting}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">入住日期 *</label>
            <input
              type="date"
              className="form-input"
              value={formData.checkInDate}
              onChange={(e) => setFormData({...formData, checkInDate: e.target.value})}
              min={new Date().toISOString().split('T')[0]}
              disabled={isSubmitting}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">離開日期 *</label>
            <input
              type="date"
              className="form-input"
              value={formData.checkOutDate}
              onChange={(e) => setFormData({...formData, checkOutDate: e.target.value})}
              min={formData.checkInDate || new Date().toISOString().split('T')[0]}
              disabled={isSubmitting}
            />
          </div>
          
          <button 
            type="submit" 
            className="btn btn-success"
            disabled={isSubmitting}
          >
            {isSubmitting ? '正在保存至雲端...' : '確認登記'}
          </button>
        </form>
      </div>
    </div>
  );
}

// 房東登入組件
function LandlordLogin({ setCurrentView }) {
  const [password, setPassword] = useState('');
  const LANDLORD_PASSWORD = '0205'; // 房東密碼

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === LANDLORD_PASSWORD) {
      setCurrentView('guestList');
    } else {
      alert('密碼錯誤');
      setPassword('');
    }
  };

  return (
    <div className="container">
      <div className="nav-header">
        <button className="nav-back" onClick={() => setCurrentView('home')}>
          ←
        </button>
        <h1 className="nav-title">房東登入</h1>
        <div></div>
      </div>
      
      <div className="card">
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">請輸入4位密碼</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="輸入密碼"
              maxLength="4"
            />
          </div>
          <button type="submit" className="btn btn-primary">
            登入
          </button>
        </form>
      </div>
    </div>
  );
}

// 房東管理介面
function LandlordDashboard({ guests, setCurrentView, landlordView, setLandlordView, setSelectedGuest, refreshGuests }) {
  const handleGuestClick = (guest) => {
    setSelectedGuest(guest);
    setCurrentView('guestDetail');
  };

  return (
    <div className="container">
      <div className="nav-header">
        <button className="nav-back" onClick={() => setCurrentView('home')}>
          ←
        </button>
        <h1 className="nav-title">房東管理</h1>
        <button 
          className="nav-back" 
          onClick={refreshGuests}
          style={{backgroundColor: '#10b981', color: 'white'}}
          title="重新載入資料"
        >
          ↻
        </button>
      </div>
      
      <div className="view-toggle">
        <button 
          className={landlordView === 'list' ? 'active' : ''}
          onClick={() => setLandlordView('list')}
        >
          列表檢視
        </button>
        <button 
          className={landlordView === 'calendar' ? 'active' : ''}
          onClick={() => setLandlordView('calendar')}
        >
          日曆檢視
        </button>
      </div>

      {landlordView === 'list' ? (
        <GuestList guests={guests} onGuestClick={handleGuestClick} />
      ) : (
        <CalendarView guests={guests} onGuestClick={handleGuestClick} />
      )}
    </div>
  );
}

// 房客列表組件
function GuestList({ guests, onGuestClick }) {
  return (
    <div>
      {guests.length === 0 ? (
        <div className="card">
          <p style={{textAlign: 'center', color: '#6b7280'}}>
            目前沒有房客資料
            <br />
            <small style={{color: '#9ca3af'}}>資料將自動從雲端同步</small>
          </p>
        </div>
      ) : (
        <>
          <div style={{textAlign: 'center', marginBottom: '1rem', color: '#6b7280', fontSize: '0.9rem'}}>
            共 {guests.length} 位房客 | 雲端即時同步
          </div>
          {guests.map(guest => (
            <div 
              key={guest.id} 
              className="guest-item"
              onClick={() => onGuestClick(guest)}
            >
              <div className="guest-name">{guest.name}</div>
              <div className="guest-date">
                入住: {guest.checkInDate} → 離開: {guest.checkOutDate}
              </div>
              <span className={`payment-status ${guest.paymentStatus === '已付款' ? 'status-paid' : 'status-unpaid'}`}>
                {guest.paymentStatus}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// 日曆檢視組件
function CalendarView({ guests, onGuestClick }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  
  // 月份導航
  const navigateMonth = (direction) => {
    const newDate = new Date(currentYear, currentMonth + direction, 1);
    setCurrentDate(newDate);
  };

  // 生成日曆數據
  const generateCalendarData = () => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay()); // 從週日開始
    
    const days = [];
    const current = new Date(startDate);
    
    // 生成6週的日期
    for (let week = 0; week < 6; week++) {
      for (let day = 0; day < 7; day++) {
        days.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
    }
    
    return days;
  };

  const days = generateCalendarData();

  // 為每個旅客分配顏色
  const getGuestColor = (guestId) => {
    const guestIndex = guests.findIndex(g => g.id === guestId);
    return `guest-color-${guestIndex % 8}`;
  };

  // 計算住宿事件 - 修復版本
  const calculateGuestEvents = () => {
    const events = [];
    
    // 智慧分配層級 - 檢測時間重疊
    const guestLevels = {};
    const sortedGuests = [...guests].sort((a, b) => new Date(a.checkInDate) - new Date(b.checkInDate));
    
    sortedGuests.forEach((guest, index) => {
      const checkIn = new Date(guest.checkInDate + 'T00:00:00');
      const checkOut = new Date(guest.checkOutDate + 'T00:00:00');
      
      // 找到合適的層級
      let level = 0;
      let levelFound = false;
      
      while (!levelFound) {
        // 檢查這個層級是否與其他房客衝突
        const hasConflict = sortedGuests.some(otherGuest => {
          if (otherGuest.id === guest.id) return false;
          if (guestLevels[otherGuest.id] !== level * 28) return false;
          
          const otherCheckIn = new Date(otherGuest.checkInDate + 'T00:00:00');
          const otherCheckOut = new Date(otherGuest.checkOutDate + 'T00:00:00');
          
          // 檢查時間是否重疊
          return (checkIn <= otherCheckOut && checkOut >= otherCheckIn);
        });
        
        if (!hasConflict) {
          guestLevels[guest.id] = level * 28; // 每層28px間距
          levelFound = true;
        } else {
          level++;
        }
      }
    });
    
    guests.forEach(guest => {
      // 確保日期字符串正確解析
      const checkIn = new Date(guest.checkInDate + 'T00:00:00');
      const checkOut = new Date(guest.checkOutDate + 'T00:00:00');
      
      console.log(`處理房客: ${guest.name}, 層級: ${guestLevels[guest.id]}px`);
      
      // 為每一週單獨計算事件
      const weekGroups = {};
      
      days.forEach((day, dayIndex) => {
        const weekIndex = Math.floor(dayIndex / 7);
        const dayOfWeek = dayIndex % 7;
        
        // 檢查這一天是否在住宿期間
        const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
        const checkInDate = new Date(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate());
        const checkOutDate = new Date(checkOut.getFullYear(), checkOut.getMonth(), checkOut.getDate());
        
        const isInStay = dayStart >= checkInDate && dayStart <= checkOutDate;
        
        if (isInStay) {
          if (!weekGroups[weekIndex]) {
            weekGroups[weekIndex] = [];
          }
          weekGroups[weekIndex].push(dayOfWeek);
        }
      });
      
      // 為每週生成連續的事件
      Object.keys(weekGroups).forEach(weekIndex => {
        const daysInWeek = weekGroups[weekIndex].sort((a, b) => a - b);
        
        // 將連續的天數分組
        const continuousGroups = [];
        let currentGroup = [daysInWeek[0]];
        
        for (let i = 1; i < daysInWeek.length; i++) {
          if (daysInWeek[i] === daysInWeek[i-1] + 1) {
            currentGroup.push(daysInWeek[i]);
          } else {
            continuousGroups.push(currentGroup);
            currentGroup = [daysInWeek[i]];
          }
        }
        continuousGroups.push(currentGroup);
        
        // 為每個連續組創建事件，使用智慧分配的層級
        continuousGroups.forEach((group, groupIndex) => {
          events.push({
            guest,
            weekIndex: parseInt(weekIndex),
            startDay: group[0],
            endDay: group[group.length - 1],
            top: guestLevels[guest.id] // 使用智慧分配的層級
          });
        });
      });
    });
    
    return events;
  };

  const guestEvents = calculateGuestEvents();

  const monthNames = [
    '1月', '2月', '3月', '4月', '5月', '6月',
    '7月', '8月', '9月', '10月', '11月', '12月'
  ];

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isCurrentMonth = (date) => {
    return date.getMonth() === currentMonth;
  };

  return (
    <div>
      <div className="month-navigation">
        <button className="month-nav-btn" onClick={() => navigateMonth(-1)}>
          ‹
        </button>
        <h3 className="month-title">
          {currentYear}年 {monthNames[currentMonth]}
        </h3>
        <button className="month-nav-btn" onClick={() => navigateMonth(1)}>
          ›
        </button>
      </div>
      
      <div className="calendar-container">
        <div className="calendar-header">
          {['日', '一', '二', '三', '四', '五', '六'].map(day => (
            <div key={day} className="calendar-header-cell">
              {day}
            </div>
          ))}
        </div>
        
        <div className="calendar-grid">
          {days.map((day, index) => {
            const weekIndex = Math.floor(index / 7);
            const dayEvents = guestEvents.filter(event => 
              event.weekIndex === weekIndex
            );
            
            // 判斷是否為週末
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            
            return (
              <div 
                key={index} 
                className={`calendar-day ${!isCurrentMonth(day) ? 'other-month' : ''} ${isToday(day) ? 'today' : ''} ${isWeekend ? 'weekend' : ''}`}
                onClick={() => {
                  const dayGuests = guests.filter(guest => {
                    const checkIn = new Date(guest.checkInDate + 'T00:00:00');
                    const checkOut = new Date(guest.checkOutDate + 'T00:00:00');
                    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
                    // 包含入住日和離開日
                    return dayStart >= checkIn && dayStart <= checkOut;
                  });
                  
                  if (dayGuests.length === 1) {
                    onGuestClick(dayGuests[0]);
                  } else if (dayGuests.length > 1) {
                    const guestNames = dayGuests.map(g => g.name).join('、');
                    alert(`${dayGuests.length}位房客：${guestNames}`);
                  }
                }}
              >
                <div className="calendar-day-number">
                  {day.getDate()}
                </div>
                
                <div className="guest-events">
                  {dayEvents.map((event, eventIndex) => {
                    const dayOfWeek = index % 7;
                    const isEventStart = dayOfWeek === event.startDay;
                    const eventWidth = (event.endDay - event.startDay + 1) * 100;
                    
                    // 只在事件開始的日期顯示長條
                    if (isEventStart) {
                      return (
                        <div
                          key={`${event.guest.id}-${event.weekIndex}-${eventIndex}`}
                          className={`guest-event ${getGuestColor(event.guest.id)}`}
                          style={{
                            top: event.top,
                            left: '0%',
                            width: `${eventWidth}%`,
                            zIndex: 10
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onGuestClick(event.guest);
                          }}
                          title={`${event.guest.name} (${event.guest.checkInDate} - ${event.guest.checkOutDate})`}
                        >
                          {event.guest.name}
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// 房客詳細資料組件
function GuestDetail({ guest, setCurrentView, landlordView, updateGuestPayment }) {
  const [isUpdating, setIsUpdating] = useState(false);

  const togglePaymentStatus = async () => {
    setIsUpdating(true);
    const newStatus = guest.paymentStatus === '已付款' ? '未付款' : '已付款';
    
    try {
      // 更新付款狀態到 Firestore
      await updateGuestPayment(guest.id, newStatus);
      
      // 更新本地 guest 對象
      guest.paymentStatus = newStatus;
      
      alert(`付款狀態已更新為：${newStatus}`);
    } catch (error) {
      console.error('Error updating payment status:', error);
      alert('更新失敗，請檢查網路連線並重試');
    }
    setIsUpdating(false);
  };

  return (
    <div className="container">
      <div className="nav-header">
        <button className="nav-back" onClick={() => setCurrentView('guestList')}>
          ←
        </button>
        <h1 className="nav-title">房客詳細資料</h1>
        <div></div>
      </div>
      
      <div className="card">
        <div style={{textAlign: 'center', marginBottom: '1.5rem', color: '#6b7280', fontSize: '0.9rem'}}>
          雲端同步資料 | ID: {guest.id.substring(0, 8)}...
        </div>
        
        <div className="form-group">
          <label className="form-label">姓名</label>
          <div style={{padding: '0.875rem', background: '#f9fafb', borderRadius: '8px'}}>
            {guest.name}
          </div>
        </div>
        
        <div className="form-group">
          <label className="form-label">電話</label>
          <div style={{padding: '0.875rem', background: '#f9fafb', borderRadius: '8px'}}>
            {guest.phone}
          </div>
        </div>
        
        <div className="form-group">
          <label className="form-label">入住日期</label>
          <div style={{padding: '0.875rem', background: '#f9fafb', borderRadius: '8px'}}>
            {guest.checkInDate}
          </div>
        </div>
        
        <div className="form-group">
          <label className="form-label">離開日期</label>
          <div style={{padding: '0.875rem', background: '#f9fafb', borderRadius: '8px'}}>
            {guest.checkOutDate}
          </div>
        </div>
        
        <div className="form-group">
          <label className="form-label">付款狀態</label>
          <div style={{padding: '0.875rem', background: '#f9fafb', borderRadius: '8px', marginBottom: '1rem'}}>
            <span className={`payment-status ${guest.paymentStatus === '已付款' ? 'status-paid' : 'status-unpaid'}`}>
              {guest.paymentStatus}
            </span>
          </div>
        </div>
        
        <button 
          className={`btn ${guest.paymentStatus === '已付款' ? 'btn-secondary' : 'btn-success'}`}
          onClick={togglePaymentStatus}
          disabled={isUpdating}
        >
          {isUpdating ? '正在更新至雲端...' : 
           guest.paymentStatus === '已付款' ? '標記為未付款' : '標記為已付款'}
        </button>
      </div>
    </div>
  );
}

export default App;