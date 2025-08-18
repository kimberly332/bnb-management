import React, { useState, useEffect } from 'react';
import './styles/App.css';
import { 
  getLandlords, 
  addLandlord, 
  loginLandlord,
  loginLandlordByPassword,
  getGuestsByLandlord, 
  addGuestToLandlord,
  updateGuestPaymentInFirestore,
  updateGuestInFirestore,
  deleteGuestFromFirestore
} from './services/landlordService';

function App() {
  const [currentView, setCurrentView] = useState('home'); // home, register, login, landlordDashboard, guestForm, guestDetail, editGuest
  const [currentLandlord, setCurrentLandlord] = useState(null); // 當前登入的房東
  const [guests, setGuests] = useState([]);
  const [selectedGuest, setSelectedGuest] = useState(null);
  const [landlordView, setLandlordView] = useState('list');
  const [loading, setLoading] = useState(false);
  const [guestFormLandlordId, setGuestFormLandlordId] = useState(null); // 用於專屬URL訪問

  // 載入房客資料
  const loadGuests = async (landlordId) => {
    if (!landlordId) return;
    setLoading(true);
    try {
      const guestData = await getGuestsByLandlord(landlordId);
      
      // 計算房客狀態
      const currentDate = new Date();
      const processedGuests = guestData.map(guest => {
        const checkInDate = new Date(guest.checkInDate + 'T00:00:00');
        const checkOutDate = new Date(guest.checkOutDate + 'T00:00:00');
        
        let status, statusText;
        if (currentDate < checkInDate) {
          status = 'upcoming';
          statusText = '即將入住';
        } else if (currentDate >= checkInDate && currentDate <= checkOutDate) {
          status = 'current';
          statusText = '入住中';
        } else {
          status = 'completed';
          statusText = '已完成';
        }
        
        return { ...guest, status, statusText };
      });
      
      setGuests(processedGuests);
    } catch (error) {
      console.error('載入房客資料失敗:', error);
      alert('載入房客資料失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  // 檢查URL參數，看是否有房東ID
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const landlordId = urlParams.get('landlord');
    
    if (landlordId) {
      setGuestFormLandlordId(landlordId);
      setCurrentView('guestForm');
    }
  }, []);

  // 房東登入後載入房客資料
  useEffect(() => {
    if (currentLandlord && currentView === 'landlordDashboard') {
      loadGuests(currentLandlord.id);
    }
  }, [currentLandlord, currentView]);

  // 新增房客
  const addGuest = async (guestData) => {
    try {
      const landlordId = guestFormLandlordId || currentLandlord?.id;
      if (!landlordId) {
        throw new Error('無法確定房東ID');
      }

      const newGuest = await addGuestToLandlord(landlordId, guestData);
      
      // 如果是當前房東的房客，更新列表
      if (currentLandlord && landlordId === currentLandlord.id) {
        setGuests(prevGuests => [...prevGuests, newGuest].sort((a, b) => new Date(a.checkInDate) - new Date(b.checkInDate)));
      }
      
      return newGuest;
    } catch (error) {
      console.error('新增房客失敗:', error);
      throw error;
    }
  };

  // 更新房客付款狀態
  const updateGuestPayment = async (guestId, paymentStatus) => {
    try {
      await updateGuestPaymentInFirestore(guestId, paymentStatus);
      setGuests(prevGuests => 
        prevGuests.map(guest => 
          guest.id === guestId ? { ...guest, paymentStatus } : guest
        )
      );
    } catch (error) {
      console.error('更新付款狀態失敗:', error);
      throw error;
    }
  };

  // 更新房客資訊
  const updateGuest = async (guestId, updateData) => {
    try {
      await updateGuestInFirestore(guestId, updateData);
      setGuests(prevGuests => 
        prevGuests.map(guest => 
          guest.id === guestId ? { ...guest, ...updateData } : guest
        ).sort((a, b) => new Date(a.checkInDate) - new Date(b.checkInDate))
      );
    } catch (error) {
      console.error('更新房客資訊失敗:', error);
      throw error;
    }
  };

  // 刪除房客
  const deleteGuest = async (guestId) => {
    try {
      await deleteGuestFromFirestore(guestId);
      setGuests(prevGuests => 
        prevGuests.filter(guest => guest.id !== guestId)
      );
    } catch (error) {
      console.error('刪除房客失敗:', error);
      throw error;
    }
  };

  // 房東登出
  const logout = () => {
    setCurrentLandlord(null);
    setGuests([]);
    setSelectedGuest(null);
    setCurrentView('home');
  };

  if (loading) {
    return (
      <div className="app">
        <div className="container">
          <div className="card">
            <div style={{textAlign: 'center', padding: '2rem'}}>
              <div style={{fontSize: '1.2rem', color: '#6b7280', marginBottom: '1rem'}}>
                正在載入資料...
              </div>
              <div className="loading-spinner"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {currentView === 'home' && (
        <HomePage setCurrentView={setCurrentView} />
      )}
      {currentView === 'register' && (
        <LandlordRegister setCurrentView={setCurrentView} />
      )}
      {currentView === 'login' && (
        <LandlordLogin 
          setCurrentView={setCurrentView} 
          setCurrentLandlord={setCurrentLandlord}
        />
      )}
      {currentView === 'landlordDashboard' && (
        <LandlordDashboard 
          landlord={currentLandlord}
          guests={guests} 
          setCurrentView={setCurrentView}
          landlordView={landlordView}
          setLandlordView={setLandlordView}
          setSelectedGuest={setSelectedGuest}
          refreshGuests={() => loadGuests(currentLandlord?.id)}
          logout={logout}
        />
      )}
      {currentView === 'guestForm' && (
        <GuestForm 
          setCurrentView={setCurrentView} 
          addGuest={addGuest} 
          guests={guests}
          landlordId={guestFormLandlordId}
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
          <h1 className="card-title">民宿管理系統</h1>
          <p style={{textAlign: 'center', color: '#6b7280', fontSize: '0.9rem', marginTop: '0.5rem'}}>
            多房東雲端管理平台 | 即時同步
          </p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => setCurrentView('register')}
        >
          房東註冊
        </button>
        <button 
          className="btn btn-secondary"
          onClick={() => setCurrentView('login')}
        >
          房東登入
        </button>
      </div>
    </div>
  );
}

// 房東註冊組件 (簡化為4位數數字)
function LandlordRegister({ setCurrentView }) {
  const [formData, setFormData] = useState({
    businessName: '',
    password: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.businessName || !formData.password) {
      alert('請填寫所有必填欄位');
      return;
    }

    if (formData.password.length !== 4 || !/^\d{4}$/.test(formData.password)) {
      alert('密碼必須為4位數字');
      return;
    }

    setIsSubmitting(true);
    try {
      await addLandlord({
        businessName: formData.businessName,
        password: formData.password
      });
      
      alert('註冊成功！請登入');
      setCurrentView('login');
    } catch (error) {
      console.error('註冊失敗:', error);
      if (error.message.includes('已被使用')) {
        alert('此4位數密碼已被其他房東使用，請選擇其他數字');
      } else {
        alert('註冊失敗，請稍後再試');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container">
      <div className="nav-header">
        <button className="nav-back" onClick={() => setCurrentView('home')}>
          ←
        </button>
        <h1 className="nav-title">房東註冊</h1>
        <div></div>
      </div>
      
      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">民宿/房屋名稱 *</label>
            <input
              type="text"
              className="form-input"
              value={formData.businessName}
              onChange={(e) => setFormData({...formData, businessName: e.target.value})}
              placeholder="例如：毓鳳頭城小屋"
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">4位數登入密碼 *</label>
            <input
              type="password"
              className="form-input"
              value={formData.password}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, ''); // 只允許數字
                if (value.length <= 4) {
                  setFormData({...formData, password: value});
                }
              }}
              placeholder="請設定4位數字密碼"
              maxLength="4"
            />
            <small style={{color: '#6b7280', fontSize: '0.85rem'}}>
              此4位數字將作為您的登入密碼，每個房東的密碼必須唯一
            </small>
          </div>
          
          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? '註冊中...' : '註冊'}
          </button>
        </form>
        
        <div style={{textAlign: 'center', marginTop: '1rem'}}>
          已有帳號？
          <button 
            onClick={() => setCurrentView('login')}
            style={{
              background: 'none',
              border: 'none',
              color: '#3b82f6',
              cursor: 'pointer',
              textDecoration: 'underline',
              marginLeft: '0.5rem'
            }}
          >
            點此登入
          </button>
        </div>
      </div>
    </div>
  );
}

// 房東登入組件 (簡化為4位數數字)
function LandlordLogin({ setCurrentView, setCurrentLandlord }) {
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!password) {
      alert('請輸入4位數密碼');
      return;
    }

    if (password.length !== 4 || !/^\d{4}$/.test(password)) {
      alert('密碼必須為4位數字');
      return;
    }

    setIsSubmitting(true);
    try {
      const landlord = await loginLandlordByPassword(password);
      setCurrentLandlord(landlord);
      setCurrentView('landlordDashboard');
    } catch (error) {
      console.error('登入失敗:', error);
      alert('登入失敗，密碼錯誤或帳號不存在');
      setPassword('');
    } finally {
      setIsSubmitting(false);
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
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">4位數登入密碼</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, ''); // 只允許數字
                if (value.length <= 4) {
                  setPassword(value);
                }
              }}
              placeholder="請輸入4位數字密碼"
              maxLength="4"
            />
            <small style={{color: '#6b7280', fontSize: '0.85rem'}}>
              請輸入您註冊時設定的4位數字密碼
            </small>
          </div>
          
          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? '登入中...' : '登入'}
          </button>
        </form>
        
        <div style={{textAlign: 'center', marginTop: '1rem'}}>
          還沒有帳號？
          <button 
            onClick={() => setCurrentView('register')}
            style={{
              background: 'none',
              border: 'none',
              color: '#3b82f6',
              cursor: 'pointer',
              textDecoration: 'underline',
              marginLeft: '0.5rem'
            }}
          >
            點此註冊
          </button>
        </div>
      </div>
    </div>
  );
}

// 房東管理介面 (保留原有UI，只在頂部添加專屬URL)
function LandlordDashboard({ landlord, guests, setCurrentView, landlordView, setLandlordView, setSelectedGuest, refreshGuests, logout }) {
  const handleGuestClick = (guest) => {
    setSelectedGuest(guest);
    setCurrentView('guestDetail');
  };

  // 生成專屬URL
  const getGuestFormUrl = () => {
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?landlord=${landlord.id}`;
  };

  const copyUrlToClipboard = () => {
    const url = getGuestFormUrl();
    navigator.clipboard.writeText(url).then(() => {
      alert('URL已複製到剪貼板！');
    }).catch(() => {
      alert(`請手動複製此URL：\n${url}`);
    });
  };

  return (
    <div className="container">
      <div className="nav-header">
        <button className="nav-back" onClick={logout}>
          ←
        </button>
        <h1 className="nav-title">{landlord.businessName}</h1>
        <button 
          className="nav-back" 
          onClick={refreshGuests}
          style={{backgroundColor: '#10b981', color: 'white'}}
          title="重新載入資料"
        >
          ↻
        </button>
      </div>

      {/* 專屬URL區域 - 新增但保持簡潔 */}
      <div className="card" style={{marginBottom: '1rem', padding: '1rem'}}>
        <h3 style={{marginBottom: '0.5rem', color: '#1e293b', fontSize: '1rem'}}>旅客登記專屬連結</h3>
        <p style={{fontSize: '0.85rem', color: '#6b7280', marginBottom: '0.75rem'}}>
          分享此連結給旅客，他們可以直接填寫入住表單
        </p>
        <div style={{display: 'flex', gap: '0.5rem'}}>
          <input
            type="text"
            value={getGuestFormUrl()}
            readOnly
            style={{
              flex: 1,
              padding: '0.5rem',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              background: '#f8fafc',
              fontSize: '0.8rem'
            }}
          />
          <button 
            onClick={copyUrlToClipboard}
            className="btn btn-primary"
            style={{width: 'auto', margin: 0, padding: '0.5rem 0.75rem', fontSize: '0.85rem'}}
          >
            複製
          </button>
        </div>
      </div>
      
      {/* 保留原有的視圖切換和內容 */}
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
        <GuestCalendar guests={guests} onGuestClick={handleGuestClick} />
      )}
    </div>
  );
}

// 旅客表單組件 - 修復「允許一退一住」機制
function GuestForm({ setCurrentView, addGuest, guests, landlordId }) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    checkInDate: '',
    checkOutDate: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [landlordInfo, setLandlordInfo] = useState(null);
  const [landlordGuests, setLandlordGuests] = useState([]); // 新增：專門存儲該房東的房客

  // 載入房東資訊
  useEffect(() => {
    if (landlordId) {
      const loadLandlordInfo = async () => {
        try {
          const landlords = await getLandlords();
          const landlord = landlords.find(l => l.id === landlordId);
          setLandlordInfo(landlord);
        } catch (error) {
          console.error('載入房東資訊失敗:', error);
        }
      };
      loadLandlordInfo();
    }
  }, [landlordId]);

  // 🎯 新增：載入該房東的房客資料
  useEffect(() => {
    const loadLandlordGuests = async () => {
      try {
        const targetLandlordId = landlordId || 'default'; // 如果沒有指定房東ID，使用預設值
        if (targetLandlordId) {
          console.log('🔍 正在載入房東房客資料，房東ID:', targetLandlordId);
          const guestData = await getGuestsByLandlord(targetLandlordId);
          console.log('🔍 載入的房客資料:', guestData);
          setLandlordGuests(guestData);
        }
      } catch (error) {
        console.error('載入房東房客資料失敗:', error);
        // 如果載入失敗，使用傳入的 guests 作為備用
        setLandlordGuests(guests || []);
      }
    };

    loadLandlordGuests();
  }, [landlordId, guests]);

  // 🎯 修復的「允許一退一住」機制 - 使用 landlordGuests 而不是 guests
  const checkTimeOverlap = (newCheckIn, newCheckOut) => {
    const guestsToCheck = landlordGuests.length > 0 ? landlordGuests : guests;
    console.log('🔍 檢查重疊時使用的房客陣列:', guestsToCheck);
    
    if (!guestsToCheck || guestsToCheck.length === 0) return [];
    
    const newCheckInDate = new Date(newCheckIn + 'T00:00:00');
    const newCheckOutDate = new Date(newCheckOut + 'T00:00:00');

    const overlappingGuests = guestsToCheck.filter(guest => {
      const existingCheckIn = new Date(guest.checkInDate + 'T00:00:00');
      const existingCheckOut = new Date(guest.checkOutDate + 'T00:00:00');
      
      console.log(`🔍 檢查房客 ${guest.name}: ${guest.checkInDate} ~ ${guest.checkOutDate}`);
      
      // 🎯 正確的「允許一退一住」邏輯：
      // 檢查一退一住的情況
      const isNewStartSameAsExistingEnd = newCheckInDate.getTime() === existingCheckOut.getTime();
      const isNewEndSameAsExistingStart = newCheckOutDate.getTime() === existingCheckIn.getTime();
      
      console.log(`🔍 一退一住檢查: 新入住=${newCheckIn} vs 現有退房=${guest.checkOutDate}, 相等=${isNewStartSameAsExistingEnd}`);
      console.log(`🔍 一退一住檢查: 新退房=${newCheckOut} vs 現有入住=${guest.checkInDate}, 相等=${isNewEndSameAsExistingStart}`);
      
      // 如果是一退一住的情況，則允許（不算重疊）
      if (isNewStartSameAsExistingEnd || isNewEndSameAsExistingStart) {
        console.log(`✅ ${guest.name} 是一退一住，允許`);
        return false;
      }
      
      // 其他情況按正常重疊邏輯判斷
      const hasOverlap = (newCheckInDate < existingCheckOut && newCheckOutDate > existingCheckIn);
      console.log(`🔍 ${guest.name} 重疊檢查結果: ${hasOverlap}`);
      return hasOverlap;
    });

    return overlappingGuests;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    console.log('🔍 調試信息：');
    console.log('guests 陣列：', guests);
    console.log('新的入住日期：', formData.checkInDate);
    console.log('新的退房日期：', formData.checkOutDate);
    
    if (!formData.name || !formData.checkInDate || !formData.checkOutDate) {
      alert('請填寫所有必填欄位');
      return;
    }

    if (new Date(formData.checkInDate) >= new Date(formData.checkOutDate)) {
      alert('退房日期必須晚於入住日期');
      return;
    }

    const overlapping = checkTimeOverlap(formData.checkInDate, formData.checkOutDate);
    console.log('重疊檢查結果：', overlapping);
    
    if (overlapping.length > 0) {
      console.log('❌ 發現重疊，應該阻止預訂');
      const names = overlapping.map(g => g.name).join('、');
      alert(`時間衝突！與以下房客的住宿時間重疊：${names}`);
      return;
    } else {
      console.log('✅ 沒有重疊，允許預訂');
    }

    setIsSubmitting(true);
    try {
      await addGuest(formData);
      alert('登記成功！');
      setFormData({
        name: '',
        phone: '',
        checkInDate: '',
        checkOutDate: ''
      });
      
      // 如果是通過專屬URL訪問，返回首頁
      if (landlordId) {
        setCurrentView('home');
      }
    } catch (error) {
      console.error('登記失敗:', error);
      alert('登記失敗，請稍後再試');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 獲取可用日期建議（找出空檔）
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
        <h1 className="nav-title">
          {landlordInfo ? `${landlordInfo.businessName} - 入住登記` : '入住登記'}
        </h1>
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
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">聯絡電話</label>
            <input
              type="tel"
              className="form-input"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              placeholder="請輸入聯絡電話"
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">入住日期 *</label>
            <input
              type="date"
              className="form-input"
              value={formData.checkInDate}
              onChange={(e) => setFormData({...formData, checkInDate: e.target.value})}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">退房日期 *</label>
            <input
              type="date"
              className="form-input"
              value={formData.checkOutDate}
              onChange={(e) => setFormData({...formData, checkOutDate: e.target.value})}
            />
          </div>
          
          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={isSubmitting || (formData.checkInDate && formData.checkOutDate && checkTimeOverlap(formData.checkInDate, formData.checkOutDate).length > 0)}
          >
            {isSubmitting ? '正在登記...' : '確認登記'}
          </button>
        </form>

        {/* 添加一退一住機制的說明 */}
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          background: '#dbeafe',
          border: '1px solid #60a5fa',
          borderRadius: '8px',
          fontSize: '0.85rem',
          color: '#1d4ed8'
        }}>
          💡 提示：系統支援「一退一住」機制，同一天退房入住無衝突
        </div>
      </div>
    </div>
  );
}

// 房客列表組件 (完全保留原有UI)
function GuestList({ guests, onGuestClick }) {
  const today = new Date();
  const todayString = today.toISOString().split('T')[0];

  const categorizeAndSortGuests = (guests) => {
    const currentGuests = [];
    const upcomingGuests = [];
    const completedGuests = [];

    guests.forEach(guest => {
      const checkInDate = new Date(guest.checkInDate);
      const checkOutDate = new Date(guest.checkOutDate);
      const today = new Date(todayString);

      if (checkOutDate < today) {
        completedGuests.push({
          ...guest,
          status: 'completed',
          statusText: '已完成'
        });
      } else if (checkInDate <= today && checkOutDate >= today) {
        currentGuests.push({
          ...guest,
          status: 'current',
          statusText: '入住中'
        });
      } else {
        upcomingGuests.push({
          ...guest,
          status: 'upcoming',
          statusText: '即將入住'
        });
      }
    });

    currentGuests.sort((a, b) => new Date(b.checkInDate) - new Date(a.checkInDate));
    upcomingGuests.sort((a, b) => new Date(a.checkInDate) - new Date(b.checkInDate));
    completedGuests.sort((a, b) => new Date(b.checkOutDate) - new Date(a.checkOutDate));

    return [...currentGuests, ...upcomingGuests, ...completedGuests];
  };

  const sortedGuests = categorizeAndSortGuests(guests);
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

// 日曆檢視組件 - 修復「允許一退一住」機制
function GuestCalendar({ guests, onGuestClick }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  
  const navigateMonth = (direction) => {
    const newDate = new Date(currentYear, currentMonth + direction, 1);
    setCurrentDate(newDate);
  };

  const generateCalendarData = () => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days = [];
    const current = new Date(startDate);
    
    for (let week = 0; week < 6; week++) {
      for (let day = 0; day < 7; day++) {
        days.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
    }
    
    return days;
  };

  const days = generateCalendarData();

  const getGuestColor = (guestId) => {
    const guestIndex = guests.findIndex(g => g.id === guestId);
    return `guest-color-${guestIndex % 8}`;
  };

  const calculateGuestEvents = () => {
    const allEvents = [];
    
    const guestLevels = {};
    const sortedGuests = [...guests].sort((a, b) => new Date(a.checkInDate) - new Date(b.checkInDate));
    
    sortedGuests.forEach((guest, index) => {
      const checkIn = new Date(guest.checkInDate + 'T00:00:00');
      const checkOut = new Date(guest.checkOutDate + 'T00:00:00');
      
      let level = 0;
      let levelFound = false;
      
      while (!levelFound) {
        const hasConflict = sortedGuests.some(otherGuest => {
          if (otherGuest.id === guest.id) return false;
          if (guestLevels[otherGuest.id] !== level * 28) return false;
          
          const otherCheckIn = new Date(otherGuest.checkInDate + 'T00:00:00');
          const otherCheckOut = new Date(otherGuest.checkOutDate + 'T00:00:00');
          
          // 🎯 修復日曆也使用同樣的「允許一退一住」邏輯
          const isStartSameAsOtherEnd = checkIn.getTime() === otherCheckOut.getTime();
          const isEndSameAsOtherStart = checkOut.getTime() === otherCheckIn.getTime();
          
          if (isStartSameAsOtherEnd || isEndSameAsOtherStart) {
            return false;
          }
          
          return (checkIn < otherCheckOut && checkOut > otherCheckIn);
        });
        
        if (!hasConflict) {
          guestLevels[guest.id] = level * 28;
          levelFound = true;
        } else {
          level++;
        }
      }
    });
    
    guests.forEach(guest => {
      const checkIn = new Date(guest.checkInDate + 'T00:00:00');
      const checkOut = new Date(guest.checkOutDate + 'T00:00:00');
      
      const weekGroups = {};
      let hasShownName = false;
      
      days.forEach((day, dayIndex) => {
        const weekIndex = Math.floor(dayIndex / 7);
        const dayOfWeek = dayIndex % 7;
        
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

      const weekGroupKeys = Object.keys(weekGroups).map(Number).sort((a, b) => a - b);
      
      weekGroupKeys.forEach((weekIndex, groupIndex) => {
        const weekGroup = weekGroups[weekIndex];
        
        let shouldShowName = false;
        
        if (groupIndex === 0) {
          shouldShowName = true;
        } else {
          const prevWeekIndex = weekGroupKeys[groupIndex - 1];
          const prevWeekGroup = weekGroups[prevWeekIndex];
          
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

// 房客詳情組件 (保留原有UI)
function GuestDetail({ guest, setCurrentView, landlordView, updateGuestPayment, updateGuest, deleteGuest, guests, setSelectedGuest }) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const togglePaymentStatus = async () => {
    setIsUpdating(true);
    const newStatus = guest.paymentStatus === '已付款' ? '未付款' : '已付款';
    
    try {
      await updateGuestPayment(guest.id, newStatus);
      setSelectedGuest({...guest, paymentStatus: newStatus});
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
      setCurrentView('landlordDashboard');
    } catch (error) {
      console.error('Error deleting guest:', error);
      alert('刪除失敗，請檢查網路連線並重試');
    }
    setIsDeleting(false);
  };

  return (
    <div className="container">
      <div className="nav-header">
        <button className="nav-back" onClick={() => setCurrentView('landlordDashboard')}>
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

// 編輯房客表單組件 - 修復「允許一退一住」機制
function EditGuestForm({ guest, setCurrentView, updateGuest, guests, setSelectedGuest }) {
  const [formData, setFormData] = useState({
    name: guest.name || '',
    phone: guest.phone || '',
    checkInDate: guest.checkInDate || '',
    checkOutDate: guest.checkOutDate || ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 🎯 修復的「允許一退一住」機制
  const checkTimeOverlap = (newCheckIn, newCheckOut) => {
    if (!guests || guests.length === 0) return [];
    
    const newCheckInDate = new Date(newCheckIn + 'T00:00:00');
    const newCheckOutDate = new Date(newCheckOut + 'T00:00:00');

    const overlappingGuests = guests.filter(otherGuest => {
      if (otherGuest.id === guest.id) return false;
      
      const existingCheckIn = new Date(otherGuest.checkInDate + 'T00:00:00');
      const existingCheckOut = new Date(otherGuest.checkOutDate + 'T00:00:00');
      
      // 🎯 正確的「允許一退一住」邏輯：
      // 檢查一退一住的情況
      const isNewStartSameAsExistingEnd = newCheckInDate.getTime() === existingCheckOut.getTime();
      const isNewEndSameAsExistingStart = newCheckOutDate.getTime() === existingCheckIn.getTime();
      
      // 如果是一退一住的情況，則允許（不算重疊）
      if (isNewStartSameAsExistingEnd || isNewEndSameAsExistingStart) {
        return false;
      }
      
      // 其他情況按正常重疊邏輯判斷
      return (newCheckInDate < existingCheckOut && newCheckOutDate > existingCheckIn);
    });

    return overlappingGuests;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.checkInDate || !formData.checkOutDate) {
      alert('請填寫所有必填欄位（姓名、入住日期、退房日期）');
      return;
    }

    const checkInDate = new Date(formData.checkInDate);
    const checkOutDate = new Date(formData.checkOutDate);
    
    if (checkOutDate <= checkInDate) {
      alert('退房日期必須晚於入住日期');
      return;
    }
    
    if (formData.checkInDate === formData.checkOutDate) {
      alert('退房日期不可和入住日期選同一天，至少需要住宿1晚');
      return;
    }

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
      await updateGuest(guest.id, formData);
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
                background: '#34d399',
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
          💡 提示：修改時會自動檢查與其他預訂的時間衝突，支援「一退一住」機制
        </div>
      </div>
    </div>
  );
}

export default App;