import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { authApi } from '../lib/firebase'

const AuthContext = createContext({ user: null, loading: true, configError: null })

export function AuthProvider({ children }) {
		const [user, setUser] = useState(null)
		const [loading, setLoading] = useState(true)
		const [configError, setConfigError] = useState(null)

	useEffect(() => {
			let unsub
			try {
				unsub = authApi.onChange(async (u) => {
					setUser(u)
					setLoading(false)
				})
			} catch (e) {
				if (e.code === 'MISSING_CONFIG') {
					setConfigError(e)
					setLoading(false)
				} else {
					throw e
				}
			}
			return () => unsub && unsub()
	}, [])

	const value = useMemo(
		() => ({
			user,
			loading,
					configError,
					signIn: authApi.signIn,
			signUp: authApi.signUp,
			signOut: authApi.signOut,
			reset: authApi.reset,
		}),
				[user, loading, configError]
	)

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

	// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
