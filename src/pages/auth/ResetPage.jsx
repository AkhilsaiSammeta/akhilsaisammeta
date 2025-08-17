import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

export default function ResetPage() {
	const { reset } = useAuth()
	const [email, setEmail] = useState('')
	const [loading, setLoading] = useState(false)

	const onSubmit = async (e) => {
		e.preventDefault()
		setLoading(true)
		try {
			await reset(email)
			toast.success('Password reset email sent')
		} catch (e) {
			toast.error(e.message)
		} finally {
			setLoading(false)
		}
	}

	return (
			<div className="auth-card glass">
			<h2>Reset password</h2>
				<form onSubmit={onSubmit} className="grid-3">
					<label className="span-3">Email<input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required /></label>
					<button className="btn btn-primary span-3" disabled={loading}>{loading ? 'Sending…' : 'Send reset'}</button>
			</form>
			<div className="muted"><Link to="/login">Back to login</Link></div>
		</div>
	)
}
