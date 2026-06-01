export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-[#0F172A] mb-6" style={{fontFamily:'Rubik,sans-serif'}}>Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {['Total Sales Today', 'Invoices Today', 'Low Stock Items', 'Total Products'].map(title => (
          <div key={title} className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <p className="text-sm text-slate-500">{title}</p>
            <p className="text-2xl font-bold text-[#0F172A] mt-1" style={{fontFamily:'Rubik,sans-serif'}}>—</p>
          </div>
        ))}
      </div>
    </div>
  )
}
