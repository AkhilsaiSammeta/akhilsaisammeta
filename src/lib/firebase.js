// Firebase initialization and basic helpers
import { initializeApp, getApps } from 'firebase/app'
import {
	getAuth,
	onAuthStateChanged,
	signInWithEmailAndPassword,
	createUserWithEmailAndPassword,
	sendPasswordResetEmail,
	signOut,
} from 'firebase/auth'
import {
	getFirestore,
	doc,
	getDoc,
	setDoc,
	addDoc,
	updateDoc,
	collection,
	serverTimestamp,
	onSnapshot,
	query,
	where,
	orderBy,
} from 'firebase/firestore'
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'

let app
export function ensureApp() {
	if (app) return app
	if (getApps().length) {
		app = getApps()[0]
		return app
	}
	const cfg = {
		apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
		authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
		projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
		storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
		messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
		appId: import.meta.env.VITE_FIREBASE_APP_ID,
	}
		const missing = Object.entries(cfg).filter(([, v]) => !v).map(([k]) => k)
	if (missing.length) {
		const err = new Error(`Missing Firebase env: ${missing.join(', ')}`)
		err.code = 'MISSING_CONFIG'
		throw err
	}
	app = initializeApp(cfg)
	return app
}

export const auth = () => getAuth(ensureApp())
export const db = () => getFirestore(ensureApp())
export const storage = () => getStorage(ensureApp())

// Auth API
export const authApi = {
	onChange: (cb) => onAuthStateChanged(auth(), cb),
	signIn: (email, password) => signInWithEmailAndPassword(auth(), email, password),
	signUp: (email, password) => createUserWithEmailAndPassword(auth(), email, password),
	reset: (email) => sendPasswordResetEmail(auth(), email),
	signOut: () => signOut(auth()),
}

// Firestore collections helpers
const roomsCol = () => collection(db(), 'rooms')
const usersCol = () => collection(db(), 'users')
const txCol = (roomId) => collection(doc(roomsCol(), roomId), 'transactions')

export async function createRoom(ownerUid) {
	// Room code like ABC123
	const code = Math.random().toString(36).slice(2, 8).toUpperCase()
	const roomRef = doc(roomsCol())
	await setDoc(roomRef, {
		code,
		ownerUid,
		members: [ownerUid],
		createdAt: serverTimestamp(),
	})
	return { id: roomRef.id, code }
}

export async function joinRoomByCode(uid, code) {
	// find room by code
	const q = query(roomsCol(), where('code', '==', code))
	return new Promise((resolve, reject) => {
		const unsub = onSnapshot(q, async (snap) => {
			unsub()
			if (snap.empty) return reject(new Error('Room not found'))
			const roomDoc = snap.docs[0]
			const roomRef = roomDoc.ref
			const data = roomDoc.data()
			if (!data.members?.includes(uid)) {
				await updateDoc(roomRef, { members: [...(data.members || []), uid] })
			}
			resolve({ id: roomDoc.id, ...data })
		}, reject)
	})
}

export function onRoomMembers(roomId, cb) {
	const ref = doc(roomsCol(), roomId)
	return onSnapshot(ref, (snap) => cb(snap.exists() ? snap.data().members || [] : []))
}

export async function addTransaction(roomId, tx) {
	// tx = { amount, name, paidBy, createdAt(optional) }
	return addDoc(txCol(roomId), {
		...tx,
		createdAt: tx.createdAt || serverTimestamp(),
	})
}

export async function updateTransaction(roomId, txId, data) {
	const ref = doc(txCol(roomId), txId)
	await updateDoc(ref, data)
}

export async function uploadTransactionReceipt(roomId, txId, file) {
	const path = `rooms/${roomId}/transactions/${txId}/${Date.now()}-${file.name}`
	const r = storageRef(storage(), path)
	const snap = await uploadBytes(r, file)
	const url = await getDownloadURL(snap.ref)
	return { url, path, contentType: file.type, size: file.size, name: file.name }
}

export function onTransactions(roomId, cb) {
	const q = query(txCol(roomId), orderBy('createdAt', 'desc'))
	return onSnapshot(q, (snap) => {
		const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
		cb(items)
	})
}

export async function getRoomByCodeOnce(code) {
	const q = query(roomsCol(), where('code', '==', code))
	return new Promise((resolve, reject) => {
		const unsub = onSnapshot(q, (snap) => {
			unsub()
			if (snap.empty) resolve(null)
			else resolve({ id: snap.docs[0].id, ...snap.docs[0].data() })
		}, reject)
	})
}

export async function getUser(uid) {
	const ref = doc(usersCol(), uid)
	const snap = await getDoc(ref)
	return snap.exists() ? snap.data() : null
}

export async function ensureUser(uid, user) {
	const ref = doc(usersCol(), uid)
	await setDoc(ref, user, { merge: true })
}

export function onUser(uid, cb) {
	const ref = doc(usersCol(), uid)
	return onSnapshot(ref, (snap) => cb(snap.exists() ? { id: uid, ...snap.data() } : null))
}

export async function updateUser(uid, data) {
	const ref = doc(usersCol(), uid)
	await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true })
}
