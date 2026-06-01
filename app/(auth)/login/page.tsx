import LoginForm from './LoginForm'

export const dynamic = 'force-dynamic'

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 bg-white rounded-2xl flex items-center justify-center overflow-hidden shadow-lg">
            <img src="/logo.png" alt="Dubai Shoppe" className="w-16 h-16 object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-white" style={{fontFamily:'Rubik,sans-serif'}}>DS POS</h1>
          <p className="text-slate-400 mt-1 text-sm">Dubai Shoppe — Camera Store</p>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-[#0F172A] mb-6" style={{fontFamily:'Rubik,sans-serif'}}>Sign In</h2>
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
