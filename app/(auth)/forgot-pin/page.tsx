import { ForgotPinForm } from '@/components/auth/ForgotPinForm'

export default function ForgotPinPage() {
  return (
    <div className="min-h-screen bg-[#111827] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-white rounded-2xl flex items-center justify-center overflow-hidden shadow-lg">
            <img src="/DUBAI LOGO BR.png" alt="Dubai Shoppe" className="w-12 h-12 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Rubik, sans-serif' }}>Forgot PIN?</h1>
          <p className="text-slate-400 mt-1 text-sm">Verify with your recovery password</p>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <ForgotPinForm />
        </div>
      </div>
    </div>
  )
}
