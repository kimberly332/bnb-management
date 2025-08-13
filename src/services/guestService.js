import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase/config';

const COLLECTION_NAME = 'guests';

// Get all guests from Firestore
export const getGuests = async () => {
  try {
    console.log('正在從 Firestore 載入房客資料...');
    const q = query(collection(db, COLLECTION_NAME), orderBy('checkInDate'));
    const querySnapshot = await getDocs(q);
    const guests = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      guests.push({ 
        id: doc.id, 
        ...data,
        // Convert Firestore timestamp to string if needed
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
      });
    });
    
    console.log(`成功載入 ${guests.length} 位房客資料:`, guests);
    return guests;
  } catch (error) {
    console.error('載入房客資料時發生錯誤:', error);
    throw new Error('無法載入房客資料，請檢查網路連線');
  }
};

// Add new guest to Firestore
export const addGuest = async (guestData) => {
  try {
    console.log('正在新增房客至 Firestore:', guestData);
    
    const newGuest = {
      ...guestData,
      paymentStatus: '未付款',
      createdAt: serverTimestamp() // Use server timestamp
    };
    
    const docRef = await addDoc(collection(db, COLLECTION_NAME), newGuest);
    
    const addedGuest = { 
      id: docRef.id, 
      ...newGuest,
      createdAt: new Date().toISOString() // For immediate display
    };
    
    console.log('成功新增房客:', addedGuest);
    return addedGuest;
  } catch (error) {
    console.error('新增房客時發生錯誤:', error);
    throw new Error('無法新增房客資料，請檢查網路連線');
  }
};

// Update guest payment status in Firestore
export const updateGuestPayment = async (guestId, paymentStatus) => {
  try {
    console.log(`正在更新房客 ${guestId} 的付款狀態為: ${paymentStatus}`);
    
    const guestRef = doc(db, COLLECTION_NAME, guestId);
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

// Delete guest from Firestore (optional function)
export const deleteGuest = async (guestId) => {
  try {
    console.log(`正在刪除房客: ${guestId}`);
    await deleteDoc(doc(db, COLLECTION_NAME, guestId));
    console.log('房客資料刪除成功');
    return true;
  } catch (error) {
    console.error('刪除房客時發生錯誤:', error);
    throw new Error('無法刪除房客資料，請檢查網路連線');
  }
};

// Update guest information (optional function for future use)
export const updateGuest = async (guestId, updateData) => {
  try {
    console.log(`正在更新房客 ${guestId} 的資料:`, updateData);
    
    const guestRef = doc(db, COLLECTION_NAME, guestId);
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