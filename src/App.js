import React, { useState, useEffect } from 'react';
import './styles/App.css';
import { 
  getGuests, 
  addGuest as addGuestToFirestore, 
  updateGuestPayment as updatePaymentInFirestore,
  updateGuest as updateGuestInFirestore,
  deleteGuest as deleteGuestFromFirestore
} from './services/guestService';

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

  // Update guest information in Firestore
  const updateGuest = async (guestId, updateData) => {
    try {
      await updateGuestInFirestore(guestId, updateData);
      setGuests(prevGuests => 
        prevGuests.map(guest => 
          guest.id === guestId ? { ...guest, ...updateData } : guest
        ).sort((a, b) => new Date(a.checkInDate) - new Date(b.checkInDate))
      );
    } catch (error) {
      console.error('Error updating guest:', error);
      throw error;
    }
  };

  // Delete guest from Firestore
  const deleteGuest = async (guestId) => {
    try {
      await deleteGuestFromFirestore(guestId);
      setGuests(prevGuests => 
        prevGuests.filter(guest => guest.id !== guestId)
      );
    } catch (error) {
      console.error('Error deleting guest:', error);
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
      {/* 修正：傳遞 guests 參數給 GuestForm */}
      {currentView === 'guest' && (
        <GuestForm 
          setCurrentView={setCurrentView} 
          addGuest={addGuest} 
          guests={guests}
        />
      )}
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
          updateGuest={updateGuest}
          deleteGuest={deleteGuest}
          guests={guests}
          setSelectedGuest={setSelectedGuest}
        />
      )}
      {currentView === 'editGuest' && (
        <EditGuestForm
          guest={selectedGuest}
          setCurrentView={setCurrentView}
          updateGuest={updateGuest}
          guests={guests}
          setSelectedGuest={setSelectedGuest}
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

// 修改後的旅客表單組件 - 防止時間段重複預訂
function GuestForm({ setCurrentView, addGuest, guests }) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    checkInDate: '',
    checkOutDate: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 檢查時間段是否與現有預訂重疊（允許一退一住）
  const checkTimeOverlap = (newCheckIn, newCheckOut) => {
    if (!guests || guests.length === 0) return [];
    
    const newCheckInDate = new Date(newCheckIn + 'T00:00:00');
    const newCheckOutDate = new Date(newCheckOut + 'T00:00:00');

    // 檢查是否與現有房客的時間重疊
    const overlappingGuests = guests.filter(guest => {
      const existingCheckIn = new Date(guest.checkInDate + 'T00:00:00');
      const existingCheckOut = new Date(guest.checkOutDate + 'T00:00:00');
      
      // 修改重疊邏輯：允許一退一住
      // 新預訂入住日期 < 現有預訂退房日期 且 新預訂退房日期 > 現有預訂入住日期
      // 這樣就允許了 8/17 退房，8/17 入住的情況
      return (newCheckInDate < existingCheckOut && newCheckOutDate > existingCheckIn);
    });

    return overlappingGuests;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // 基本驗證
    if (!formData.name || !formData.checkInDate || !formData.checkOutDate) {
      alert('請填寫所有必填欄位（姓名、入住日期、退房日期）');
      return;
    }

    // 檢查日期邏輯
    const checkInDate = new Date(formData.checkInDate);
    const checkOutDate = new Date(formData.checkOutDate);
    
    if (checkOutDate <= checkInDate) {
      alert('退房日期必須晚於入住日期');
      return;
    }
    
    // 檢查是否為同一天（不允許0晚住宿）
    if (formData.checkInDate === formData.checkOutDate) {
      alert('退房日期不可和入住日期選同一天，至少需要住宿1晚');
      return;
    }

    // 檢查時間段是否重疊
    const overlappingGuests = checkTimeOverlap(formData.checkInDate, formData.checkOutDate);
    
    if (overlappingGuests.length > 0) {
      const conflictInfo = overlappingGuests.map(guest => 
        `${guest.name} (${guest.checkInDate} ~ ${guest.checkOutDate})`
      ).join('\n');
      
      alert(`預訂失敗！\n\n所選時間段與以下現有預訂重疊：\n${conflictInfo}\n\n請選擇其他日期。`);
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

  // 獲取可用日期建議（找出空檔，至少1晚住宿）
  const getAvailableDateSuggestions = () => {
    if (!formData.checkInDate || !guests) return [];
    
    const requestedCheckIn = new Date(formData.checkInDate + 'T00:00:00');
    const suggestions = [];
    
    // 檢查接下來30天內的可用日期
    for (let i = 0; i < 30; i++) {
      const testDate = new Date(requestedCheckIn);
      testDate.setDate(testDate.getDate() + i);
      
      // 檢查從這個日期開始是否有至少1晚可用（退房日期是隔天）
      const testCheckOut = new Date(testDate);
      testCheckOut.setDate(testCheckOut.getDate() + 1);
      
      const hasOverlap = checkTimeOverlap(
        testDate.toISOString().split('T')[0],
        testCheckOut.toISOString().split('T')[0]
      );
      
      if (hasOverlap.length === 0) {
        suggestions.push(testDate.toISOString().split('T')[0]);
        if (suggestions.length >= 5) break; // 最多顯示5個建議
      }
    }
    
    return suggestions;
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
        {/* 添加預訂衝突警告 */}
        {formData.checkInDate && formData.checkOutDate && (
          (() => {
            const overlaps = checkTimeOverlap(formData.checkInDate, formData.checkOutDate);
            if (overlaps.length > 0) {
              const suggestions = getAvailableDateSuggestions();
              return (
                <div style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  padding: '1rem',
                  marginBottom: '1rem',
                  color: '#dc2626'
                }}>
                  <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
                    ⚠️ 時間衝突警告
                  </div>
                  <div style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                    所選時間段與以下預訂重疊：
                  </div>
                  {overlaps.map(guest => (
                    <div key={guest.id} style={{ 
                      fontSize: '0.85rem', 
                      background: 'rgba(220, 38, 38, 0.1)', 
                      padding: '0.25rem 0.5rem', 
                      borderRadius: '4px',
                      margin: '0.25rem 0'
                    }}>
                      {guest.name} ({guest.checkInDate} ~ {guest.checkOutDate})
                    </div>
                  ))}
                  
                  {suggestions.length > 0 && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: '500', marginBottom: '0.25rem' }}>
                        建議可用日期：
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {suggestions.map(date => (
                          <button
                            key={date}
                            type="button"
                            onClick={() => setFormData({...formData, checkInDate: date, checkOutDate: ''})}
                            style={{
                              background: '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.75rem',
                              cursor: 'pointer'
                            }}
                          >
                            {date}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            }
            return null;
          })()
        )}

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
              onChange={(e) => setFormData({...formData, checkInDate: e.target.value, checkOutDate: ''})}
              min={new Date().toISOString().split('T')[0]}
              disabled={isSubmitting}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">退房日期 *</label>
            <input
              type="date"
              className="form-input"
              value={formData.checkOutDate}
              onChange={(e) => setFormData({...formData, checkOutDate: e.target.value})}
              min={formData.checkInDate ? 
                (() => {
                  const nextDay = new Date(formData.checkInDate);
                  nextDay.setDate(nextDay.getDate() + 1);
                  return nextDay.toISOString().split('T')[0];
                })() :
                new Date().toISOString().split('T')[0]
              }
              disabled={isSubmitting}
            />
          </div>
          
          <button 
            type="submit" 
            className="btn btn-success"
            disabled={isSubmitting || (formData.checkInDate && formData.checkOutDate && checkTimeOverlap(formData.checkInDate, formData.checkOutDate).length > 0)}
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
  // 獲取當前日期
  const today = new Date();
  const todayString = today.toISOString().split('T')[0];

  // 分類和排序房客
  const categorizeAndSortGuests = (guests) => {
    const currentGuests = [];
    const upcomingGuests = [];
    const completedGuests = [];

    guests.forEach(guest => {
      const checkInDate = new Date(guest.checkInDate);
      const checkOutDate = new Date(guest.checkOutDate);
      const today = new Date(todayString);

      if (checkOutDate < today) {
        // 已完成 - 已過退房日期
        completedGuests.push({
          ...guest,
          status: 'completed',
          statusText: '已完成'
        });
      } else if (checkInDate <= today && checkOutDate >= today) {
        // 目前入住中
        currentGuests.push({
          ...guest,
          status: 'current',
          statusText: '入住中'
        });
      } else {
        // 即將入住
        upcomingGuests.push({
          ...guest,
          status: 'upcoming',
          statusText: '即將入住'
        });
      }
    });

    // 排序邏輯
    // 1. 目前入住中 - 按入住日期排序（最近入住的在前）
    currentGuests.sort((a, b) => new Date(b.checkInDate) - new Date(a.checkInDate));
    
    // 2. 即將入住 - 按入住日期排序（最近的在前）
    upcomingGuests.sort((a, b) => new Date(a.checkInDate) - new Date(b.checkInDate));
    
    // 3. 已完成 - 按退房日期排序（最近完成的在前）
    completedGuests.sort((a, b) => new Date(b.checkOutDate) - new Date(a.checkOutDate));

    return [...currentGuests, ...upcomingGuests, ...completedGuests];
  };

  const sortedGuests = categorizeAndSortGuests(guests);

  // 計算各類別數量
  const currentCount = sortedGuests.filter(g => g.status === 'current').length;
  const upcomingCount = sortedGuests.filter(g => g.status === 'upcoming').length;
  const completedCount = sortedGuests.filter(g => g.status === 'completed').length;

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
          {/* 統計資訊 */}
          <div style={{
            textAlign: 'center', 
            marginBottom: '1rem', 
            background: '#f8fafc',
            padding: '0.75rem',
            borderRadius: '8px',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{color: '#64748b', fontSize: '0.9rem', marginBottom: '0.25rem'}}>
              共 {guests.length} 位房客 | 雲端即時同步
            </div>
            <div style={{
              display: 'flex', 
              justifyContent: 'center', 
              gap: '1rem',
              fontSize: '0.85rem'
            }}>
              {currentCount > 0 && (
                <span style={{color: '#059669'}}>
                  入住中: {currentCount}
                </span>
              )}
              {upcomingCount > 0 && (
                <span style={{color: '#0369a1'}}>
                  即將入住: {upcomingCount}
                </span>
              )}
              {completedCount > 0 && (
                <span style={{color: '#6b7280'}}>
                  已完成: {completedCount}
                </span>
              )}
            </div>
          </div>

          {/* 房客列表 */}
          {sortedGuests.map((guest, index) => {
            const isFirstInCategory = 
              index === 0 || 
              sortedGuests[index - 1].status !== guest.status;

            return (
              <div key={guest.id}>
                {/* 分類標題 */}
                {isFirstInCategory && (
                  <div style={{
                    padding: '0.5rem 0',
                    margin: '1rem 0 0.5rem 0',
                    borderTop: index > 0 ? '1px solid #e2e8f0' : 'none',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    color: guest.status === 'current' ? '#059669' : 
                           guest.status === 'upcoming' ? '#0369a1' : '#6b7280'
                  }}>
                    {guest.status === 'current' && '🏠 目前入住中'}
                    {guest.status === 'upcoming' && '📅 即將入住'}
                    {guest.status === 'completed' && '✅ 已完成'}
                  </div>
                )}

                {/* 房客卡片 */}
                <div 
                  className="guest-item"
                  onClick={() => onGuestClick(guest)}
                  style={{
                    opacity: guest.status === 'completed' ? 0.7 : 1,
                    background: guest.status === 'completed' ? '#f8fafc' : 'white'
                  }}
                >
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                    <div style={{flex: 1}}>
                      <div className="guest-name" style={{
                        textDecoration: guest.status === 'completed' ? 'line-through' : 'none'
                      }}>
                        {guest.name}
                      </div>
                      <div className="guest-date">
                        入住: {guest.checkInDate} → 退房: {guest.checkOutDate}
                      </div>
                    </div>
                    
                    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem'}}>
                      {/* 住宿狀態 */}
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        background: guest.status === 'current' ? '#dcfce7' : 
                                   guest.status === 'upcoming' ? '#dbeafe' : '#f1f5f9',
                        color: guest.status === 'current' ? '#059669' : 
                               guest.status === 'upcoming' ? '#0369a1' : '#64748b'
                      }}>
                        {guest.statusText}
                      </span>
                      
                      {/* 付款狀態 */}
                      <span className={`payment-status ${guest.paymentStatus === '已付款' ? 'status-paid' : 'status-unpaid'}`}>
                        {guest.paymentStatus}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

// 優化的日曆檢視組件
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

  // 優化的房客事件計算 - 姓名只在住宿開始時顯示一次
  const calculateGuestEvents = () => {
    const allEvents = [];
    
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
          
          // 檢查時間是否重疊（允許一退一住）
          return (checkIn < otherCheckOut && checkOut > otherCheckIn);
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
      
      // 為每一週單獨計算事件
      const weekGroups = {};
      let hasShownName = false; // 追踪是否已經顯示過姓名
      
      days.forEach((day, dayIndex) => {
        const weekIndex = Math.floor(dayIndex / 7);
        const dayOfWeek = dayIndex % 7;
        
        // 檢查這一天是否在住宿期間
        const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
        const isInStay = dayStart >= checkIn && dayStart <= checkOut;
        
        if (isInStay) {
          if (!weekGroups[weekIndex]) {
            weekGroups[weekIndex] = {
              startDay: dayOfWeek,
              endDay: dayOfWeek,
              guest: guest,
              weekIndex: weekIndex,
              top: guestLevels[guest.id] + 'px'
            };
          } else {
            weekGroups[weekIndex].endDay = dayOfWeek;
          }
        }
      });

      // 將週組轉換為事件，姓名只在整個住宿期間顯示一次
      const weekGroupKeys = Object.keys(weekGroups).map(Number).sort((a, b) => a - b);
      
      weekGroupKeys.forEach((weekIndex, groupIndex) => {
        const weekGroup = weekGroups[weekIndex];
        
        // 只在第一個週組顯示姓名，或者當週組不連續時顯示姓名
        let shouldShowName = false;
        
        if (groupIndex === 0) {
          // 第一個週組總是顯示姓名
          shouldShowName = true;
        } else {
          // 檢查前一週是否連續
          const prevWeekIndex = weekGroupKeys[groupIndex - 1];
          const prevWeekGroup = weekGroups[prevWeekIndex];
          
          // 如果前一週的結束不是週六(6)，或者這週的開始不是週日(0)，
          // 或者週次不連續，則顯示姓名
          const isWeekContinuous = (prevWeekIndex === weekIndex - 1);
          const isPrevWeekEndingSaturday = (prevWeekGroup.endDay === 6);
          const isCurrentWeekStartingSunday = (weekGroup.startDay === 0);
          
          if (!isWeekContinuous || 
              !(isPrevWeekEndingSaturday && isCurrentWeekStartingSunday)) {
            shouldShowName = true;
          }
        }

        allEvents.push({
          ...weekGroup,
          showName: shouldShowName
        });
      });
    });
    
    return allEvents;
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
            const dayOfWeek = index % 7;
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
                          {/* 只在需要顯示姓名的地方顯示 */}
                          {event.showName ? event.guest.name : ''}
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
function GuestDetail({ guest, setCurrentView, landlordView, updateGuestPayment, updateGuest, deleteGuest, guests, setSelectedGuest }) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleEditGuest = () => {
    setCurrentView('editGuest');
  };

  const handleDeleteGuest = async () => {
    const confirmDelete = window.confirm(
      `確定要刪除房客「${guest.name}」的預訂嗎？\n\n此操作無法復原！`
    );
    
    if (!confirmDelete) return;

    setIsDeleting(true);
    try {
      await deleteGuest(guest.id);
      alert('房客資料已成功刪除');
      setCurrentView('guestList');
    } catch (error) {
      console.error('Error deleting guest:', error);
      alert('刪除失敗，請檢查網路連線並重試');
    }
    setIsDeleting(false);
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
            {guest.phone || '未提供'}
          </div>
        </div>
        
        <div className="form-group">
          <label className="form-label">入住日期</label>
          <div style={{padding: '0.875rem', background: '#f9fafb', borderRadius: '8px'}}>
            {guest.checkInDate}
          </div>
        </div>
        
        <div className="form-group">
          <label className="form-label">退房日期</label>
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
        
        {/* 操作按鈕區域 */}
        <div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
          {/* 付款狀態切換 */}
          <button 
            className={`btn ${guest.paymentStatus === '已付款' ? 'btn-secondary' : 'btn-success'}`}
            onClick={togglePaymentStatus}
            disabled={isUpdating || isDeleting}
          >
            {isUpdating ? '正在更新至雲端...' : 
             guest.paymentStatus === '已付款' ? '標記為未付款' : '標記為已付款'}
          </button>

          {/* 修改和刪除按鈕並排 */}
          <div style={{display: 'flex', gap: '0.75rem'}}>
            {/* 修改預訊按鈕 - 較柔和的藍色 */}
            <button 
              className="btn"
              onClick={handleEditGuest}
              disabled={isUpdating || isDeleting}
              style={{
                flex: 1,
                background: '#60a5fa',
                color: 'white',
                border: '1px solid #60a5fa',
                transition: 'all 0.2s ease'
              }}
            >
              📝 修改資料
            </button>

            {/* 刪除預訂按鈕 - 較柔和的紅色 */}
            <button 
              className="btn"
              onClick={handleDeleteGuest}
              disabled={isUpdating || isDeleting}
              style={{
                flex: 1,
                background: '#f87171',
                color: 'white',
                border: '1px solid #f87171',
                transition: 'all 0.2s ease'
              }}
            >
              {isDeleting ? '刪除中...' : '🗑️ 刪除'}
            </button>
          </div>
        </div>
        
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          background: '#fef3c7',
          border: '1px solid #fbbf24',
          borderRadius: '8px',
          fontSize: '0.85rem',
          color: '#92400e'
        }}>
          ⚠️ 修改和刪除操作僅限房東使用，請謹慎操作
        </div>
      </div>
    </div>
  );
}

// 編輯房客表單組件
function EditGuestForm({ guest, setCurrentView, updateGuest, guests, setSelectedGuest }) {
  const [formData, setFormData] = useState({
    name: guest.name || '',
    phone: guest.phone || '',
    checkInDate: guest.checkInDate || '',
    checkOutDate: guest.checkOutDate || ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 檢查時間段是否與其他現有預訂重疊（排除當前房客）
  const checkTimeOverlap = (newCheckIn, newCheckOut) => {
    if (!guests || guests.length === 0) return [];
    
    const newCheckInDate = new Date(newCheckIn + 'T00:00:00');
    const newCheckOutDate = new Date(newCheckOut + 'T00:00:00');

    // 檢查是否與其他房客的時間重疊（排除當前編輯的房客）
    const overlappingGuests = guests.filter(otherGuest => {
      if (otherGuest.id === guest.id) return false; // 排除當前房客
      
      const existingCheckIn = new Date(otherGuest.checkInDate + 'T00:00:00');
      const existingCheckOut = new Date(otherGuest.checkOutDate + 'T00:00:00');
      
      // 修改重疊邏輯：允許一退一住
      return (newCheckInDate < existingCheckOut && newCheckOutDate > existingCheckIn);
    });

    return overlappingGuests;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // 基本驗證
    if (!formData.name || !formData.checkInDate || !formData.checkOutDate) {
      alert('請填寫所有必填欄位（姓名、入住日期、退房日期）');
      return;
    }

    // 檢查日期邏輯
    const checkInDate = new Date(formData.checkInDate);
    const checkOutDate = new Date(formData.checkOutDate);
    
    if (checkOutDate <= checkInDate) {
      alert('退房日期必須晚於入住日期');
      return;
    }
    
    // 檢查是否為同一天（不允許0晚住宿）
    if (formData.checkInDate === formData.checkOutDate) {
      alert('退房日期不可和入住日期選同一天，至少需要住宿1晚');
      return;
    }

    // 檢查時間段是否與其他預訂重疊
    const overlappingGuests = checkTimeOverlap(formData.checkInDate, formData.checkOutDate);
    
    if (overlappingGuests.length > 0) {
      const conflictInfo = overlappingGuests.map(otherGuest => 
        `${otherGuest.name} (${otherGuest.checkInDate} ~ ${otherGuest.checkOutDate})`
      ).join('\n');
      
      alert(`修改失敗！\n\n所選時間段與以下現有預訂重疊：\n${conflictInfo}\n\n請選擇其他日期。`);
      return;
    }

    setIsSubmitting(true);
    try {
      // 更新房客資料到 Firestore
      await updateGuest(guest.id, formData);
      
      // 更新本地選中的房客對象
      setSelectedGuest({...guest, ...formData});
      
      alert('房客資料修改成功！');
      setCurrentView('guestDetail');
    } catch (error) {
      console.error('Error updating guest:', error);
      alert('修改失敗，請檢查網路連線並重試');
    }
    setIsSubmitting(false);
  };

  // 獲取可用日期建議（找出空檔，排除當前房客）
  const getAvailableDateSuggestions = () => {
    if (!formData.checkInDate || !guests) return [];
    
    const requestedCheckIn = new Date(formData.checkInDate + 'T00:00:00');
    const suggestions = [];
    
    // 檢查接下來30天內的可用日期
    for (let i = 0; i < 30; i++) {
      const testDate = new Date(requestedCheckIn);
      testDate.setDate(testDate.getDate() + i);
      
      // 檢查從這個日期開始是否有至少1晚可用（退房日期是隔天）
      const testCheckOut = new Date(testDate);
      testCheckOut.setDate(testCheckOut.getDate() + 1);
      
      const hasOverlap = checkTimeOverlap(
        testDate.toISOString().split('T')[0],
        testCheckOut.toISOString().split('T')[0]
      );
      
      if (hasOverlap.length === 0) {
        suggestions.push(testDate.toISOString().split('T')[0]);
        if (suggestions.length >= 5) break; // 最多顯示5個建議
      }
    }
    
    return suggestions;
  };

  return (
    <div className="container">
      <div className="nav-header">
        <button className="nav-back" onClick={() => setCurrentView('guestDetail')}>
          ←
        </button>
        <h1 className="nav-title">修改預訂資料</h1>
        <div></div>
      </div>
      
      <div className="card">
        <div style={{textAlign: 'center', marginBottom: '1rem', color: '#6b7280', fontSize: '0.9rem'}}>
          修改房客：{guest.name} | ID: {guest.id.substring(0, 8)}...
        </div>

        {/* 添加修改衝突警告 */}
        {formData.checkInDate && formData.checkOutDate && (
          (() => {
            const overlaps = checkTimeOverlap(formData.checkInDate, formData.checkOutDate);
            if (overlaps.length > 0) {
              const suggestions = getAvailableDateSuggestions();
              return (
                <div style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  padding: '1rem',
                  marginBottom: '1rem',
                  color: '#dc2626'
                }}>
                  <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
                    ⚠️ 時間衝突警告
                  </div>
                  <div style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                    所選時間段與以下預訂重疊：
                  </div>
                  {overlaps.map(otherGuest => (
                    <div key={otherGuest.id} style={{ 
                      fontSize: '0.85rem', 
                      background: 'rgba(220, 38, 38, 0.1)', 
                      padding: '0.25rem 0.5rem', 
                      borderRadius: '4px',
                      margin: '0.25rem 0'
                    }}>
                      {otherGuest.name} ({otherGuest.checkInDate} ~ {otherGuest.checkOutDate})
                    </div>
                  ))}
                  
                  {suggestions.length > 0 && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: '500', marginBottom: '0.25rem' }}>
                        建議可用日期：
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {suggestions.map(date => (
                          <button
                            key={date}
                            type="button"
                            onClick={() => setFormData({...formData, checkInDate: date, checkOutDate: ''})}
                            style={{
                              background: '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.75rem',
                              cursor: 'pointer'
                            }}
                          >
                            {date}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            }
            return null;
          })()
        )}

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
              onChange={(e) => setFormData({...formData, checkInDate: e.target.value, checkOutDate: ''})}
              disabled={isSubmitting}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">退房日期 *</label>
            <input
              type="date"
              className="form-input"
              value={formData.checkOutDate}
              onChange={(e) => setFormData({...formData, checkOutDate: e.target.value})}
              min={formData.checkInDate ? 
                (() => {
                  const nextDay = new Date(formData.checkInDate);
                  nextDay.setDate(nextDay.getDate() + 1);
                  return nextDay.toISOString().split('T')[0];
                })() :
                undefined
              }
              disabled={isSubmitting}
            />
          </div>
          
          <div style={{display: 'flex', gap: '0.75rem'}}>
            <button 
              type="submit" 
              className="btn"
              disabled={isSubmitting || (formData.checkInDate && formData.checkOutDate && checkTimeOverlap(formData.checkInDate, formData.checkOutDate).length > 0)}
              style={{
                flex: 1,
                background: '#rgb(16, 185, 129)',
                color: 'white',
                border: '1px solid #34d399',
                transition: 'all 0.2s ease'
              }}
            >
              {isSubmitting ? '保存中...' : '💾 確認修改'}
            </button>

            <button 
              type="button"
              className="btn"
              onClick={() => setCurrentView('guestDetail')}
              disabled={isSubmitting}
              style={{
                flex: 1,
                background: '#9ca3af',
                color: 'white',
                border: '1px solid #9ca3af',
                transition: 'all 0.2s ease'
              }}
            >
              取消修改
            </button>
          </div>
        </form>
        
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          background: '#dbeafe',
          border: '1px solid #60a5fa',
          borderRadius: '8px',
          fontSize: '0.85rem',
          color: '#1d4ed8'
        }}>
          💡 提示：修改時會自動檢查與其他預訂的時間衝突
        </div>
      </div>
    </div>
  );
}

export default App;