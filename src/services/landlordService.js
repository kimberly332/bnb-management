import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase/config';

const LANDLORDS_COLLECTION = 'landlords';
const GUESTS_COLLECTION = 'guests';

// ========== 房東相關操作 ==========

/**
 * 獲取所有房東
 */
export const getLandlords = async () => {
  try {
    console.log('正在從 Firestore 載入房東資料...');
    const querySnapshot = await getDocs(collection(db, LANDLORDS_COLLECTION));
    const landlords = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      landlords.push({ 
        id: doc.id, 
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
      });
    });
    
    console.log(`成功載入 ${landlords.length} 位房東資料:`, landlords);
    return landlords;
  } catch (error) {
    console.error('載入房東資料時發生錯誤:', error);
    throw new Error('無法載入房東資料，請檢查網路連線');
  }
};

/**
 * 新增房東 (簡化版本，只需要4位數密碼)
 */
export const addLandlord = async (landlordData) => {
  try {
    console.log('正在新增房東至 Firestore:', landlordData);
    
    // 檢查4位數密碼是否已被使用
    const existingLandlords = await getLandlords();
    const passwordExists = existingLandlords.some(landlord => 
      landlord.password === landlordData.password
    );
    
    if (passwordExists) {
      throw new Error('此4位數密碼已被其他房東使用，請選擇其他數字');
    }
    
    const newLandlord = {
      ...landlordData,
      createdAt: serverTimestamp()
    };
    
    const docRef = await addDoc(collection(db, LANDLORDS_COLLECTION), newLandlord);
    
    const addedLandlord = { 
      id: docRef.id, 
      ...newLandlord,
      createdAt: new Date().toISOString()
    };
    
    console.log('成功新增房東:', addedLandlord);
    return addedLandlord;
  } catch (error) {
    console.error('新增房東時發生錯誤:', error);
    throw error;
  }
};

/**
 * 房東登入驗證 (原有的按姓名登入，保留兼容性)
 */
export const loginLandlord = async (name, password) => {
  try {
    console.log(`正在驗證房東登入: ${name}`);
    
    const landlords = await getLandlords();
    const landlord = landlords.find(l => 
      l.name && l.name.toLowerCase() === name.toLowerCase() && l.password === password
    );
    
    if (!landlord) {
      throw new Error('姓名或密碼錯誤');
    }
    
    console.log('房東登入成功:', { id: landlord.id, name: landlord.name, businessName: landlord.businessName });
    return landlord;
  } catch (error) {
    console.error('房東登入失敗:', error);
    throw error;
  }
};

/**
 * 房東登入驗證 (新版本，只用4位數密碼)
 */
export const loginLandlordByPassword = async (password) => {
  try {
    console.log(`正在驗證房東登入，密碼: ${password}`);
    
    const landlords = await getLandlords();
    const landlord = landlords.find(l => l.password === password);
    
    if (!landlord) {
      throw new Error('密碼錯誤或帳號不存在');
    }
    
    console.log('房東登入成功:', { id: landlord.id, businessName: landlord.businessName });
    return landlord;
  } catch (error) {
    console.error('房東登入失敗:', error);
    throw error;
  }
};

/**
 * 更新房東資訊
 */
export const updateLandlord = async (landlordId, updateData) => {
  try {
    console.log(`正在更新房東 ${landlordId} 的資料:`, updateData);
    
    const landlordRef = doc(db, LANDLORDS_COLLECTION, landlordId);
    await updateDoc(landlordRef, {
      ...updateData,
      updatedAt: serverTimestamp()
    });
    
    console.log('房東資料更新成功');
    return true;
  } catch (error) {
    console.error('更新房東資料時發生錯誤:', error);
    throw new Error('無法更新房東資料，請檢查網路連線');
  }
};

// ========== 房客相關操作 ==========

/**
 * 根據房東ID獲取房客列表
 */
export const getGuestsByLandlord = async (landlordId) => {
  try {
    console.log(`正在載入房東 ${landlordId} 的房客資料...`);
    
    const q = query(
      collection(db, GUESTS_COLLECTION), 
      where('landlordId', '==', landlordId),
      orderBy('checkInDate')
    );
    
    const querySnapshot = await getDocs(q);
    const guests = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      guests.push({ 
        id: doc.id, 
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
      });
    });
    
    console.log(`成功載入房東 ${landlordId} 的 ${guests.length} 位房客資料:`, guests);
    return guests;
  } catch (error) {
    console.error('載入房客資料時發生錯誤:', error);
    throw new Error('無法載入房客資料，請檢查網路連線');
  }
};

/**
 * 為指定房東新增房客
 */
export const addGuestToLandlord = async (landlordId, guestData) => {
  try {
    console.log(`正在為房東 ${landlordId} 新增房客:`, guestData);
    
    const newGuest = {
      ...guestData,
      landlordId: landlordId,
      paymentStatus: '未付款',
      createdAt: serverTimestamp()
    };
    
    const docRef = await addDoc(collection(db, GUESTS_COLLECTION), newGuest);
    
    const addedGuest = { 
      id: docRef.id, 
      ...newGuest,
      createdAt: new Date().toISOString()
    };
    
    console.log('成功新增房客:', addedGuest);
    return addedGuest;
  } catch (error) {
    console.error('新增房客時發生錯誤:', error);
    throw new Error('無法新增房客資料，請檢查網路連線');
  }
};

/**
 * 更新房客付款狀態
 */
export const updateGuestPaymentInFirestore = async (guestId, paymentStatus) => {
  try {
    console.log(`正在更新房客 ${guestId} 的付款狀態為: ${paymentStatus}`);
    
    const guestRef = doc(db, GUESTS_COLLECTION, guestId);
    await updateDoc(guestRef, { 
      paymentStatus,
      updatedAt: serverTimestamp()
    });
    
    console.log('付款狀態更新成功');
    return true;
  } catch (error) {
    console.error('更新付款狀態時發生錯誤:', error);
    throw new Error('無法更新付款狀態，請檢查網路連線');
  }
};

/**
 * 更新房客資訊
 */
export const updateGuestInFirestore = async (guestId, updateData) => {
  try {
    console.log(`正在更新房客 ${guestId} 的資料:`, updateData);
    
    const guestRef = doc(db, GUESTS_COLLECTION, guestId);
    await updateDoc(guestRef, {
      ...updateData,
      updatedAt: serverTimestamp()
    });
    
    console.log('房客資料更新成功');
    return true;
  } catch (error) {
    console.error('更新房客資料時發生錯誤:', error);
    throw new Error('無法更新房客資料，請檢查網路連線');
  }
};

/**
 * 刪除房客
 */
export const deleteGuestFromFirestore = async (guestId) => {
  try {
    console.log(`正在刪除房客: ${guestId}`);
    await deleteDoc(doc(db, GUESTS_COLLECTION, guestId));
    console.log('房客資料刪除成功');
    return true;
  } catch (error) {
    console.error('刪除房客時發生錯誤:', error);
    throw new Error('無法刪除房客資料，請檢查網路連線');
  }
};

// ========== 統計相關操作 ==========

/**
 * 獲取房東的統計資料
 */
export const getLandlordStats = async (landlordId) => {
  try {
    const guests = await getGuestsByLandlord(landlordId);
    const currentDate = new Date();
    
    const stats = {
      totalGuests: guests.length,
      currentGuests: 0,
      upcomingGuests: 0,
      completedGuests: 0,
      paidGuests: 0,
      unpaidGuests: 0
    };
    
    guests.forEach(guest => {
      const checkInDate = new Date(guest.checkInDate + 'T00:00:00');
      const checkOutDate = new Date(guest.checkOutDate + 'T00:00:00');
      
      // 住宿狀態統計
      if (currentDate < checkInDate) {
        stats.upcomingGuests++;
      } else if (currentDate >= checkInDate && currentDate <= checkOutDate) {
        stats.currentGuests++;
      } else {
        stats.completedGuests++;
      }
      
      // 付款狀態統計
      if (guest.paymentStatus === '已付款') {
        stats.paidGuests++;
      } else {
        stats.unpaidGuests++;
      }
    });
    
    console.log(`房東 ${landlordId} 的統計資料:`, stats);
    return stats;
  } catch (error) {
    console.error('獲取統計資料時發生錯誤:', error);
    throw new Error('無法獲取統計資料，請檢查網路連線');
  }
};

// ========== 工具函數 ==========

/**
 * 根據房東ID生成專屬URL
 */
export const generateGuestFormUrl = (landlordId) => {
  const baseUrl = window.location.origin + window.location.pathname;
  return `${baseUrl}?landlord=${landlordId}`;
};

/**
 * 檢查房客時間是否衝突
 */
export const checkGuestTimeConflict = async (landlordId, checkInDate, checkOutDate, excludeGuestId = null) => {
  try {
    const guests = await getGuestsByLandlord(landlordId);
    const newCheckIn = new Date(checkInDate + 'T00:00:00');
    const newCheckOut = new Date(checkOutDate + 'T00:00:00');
    
    const conflicts = guests.filter(guest => {
      // 如果是更新現有房客，排除自己
      if (excludeGuestId && guest.id === excludeGuestId) {
        return false;
      }
      
      const existingCheckIn = new Date(guest.checkInDate + 'T00:00:00');
      const existingCheckOut = new Date(guest.checkOutDate + 'T00:00:00');
      
      // 檢查時間重疊
      return (newCheckIn < existingCheckOut && newCheckOut > existingCheckIn);
    });
    
    return conflicts;
  } catch (error) {
    console.error('檢查時間衝突時發生錯誤:', error);
    throw new Error('無法檢查時間衝突，請檢查網路連線');
  }
};

export default {
  // 房東操作
  getLandlords,
  addLandlord,
  loginLandlord,
  loginLandlordByPassword,
  updateLandlord,
  
  // 房客操作
  getGuestsByLandlord,
  addGuestToLandlord,
  updateGuestPaymentInFirestore,
  updateGuestInFirestore,
  deleteGuestFromFirestore,
  
  // 統計與工具
  getLandlordStats,
  generateGuestFormUrl,
  checkGuestTimeConflict
};