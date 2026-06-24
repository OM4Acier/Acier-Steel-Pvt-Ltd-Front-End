export default function TasksPage() {


    return (
        <div id="loginScreen" >
  <div className="login-box">
    <div className="login-logo bg-black">
      <div className="login-logo-icon">A</div>
      <div className="login-logo-name">Acier Steel</div>
      <div className="login-logo-sub">Pvt Ltd</div>

      
    </div>
    <h2>Sign in to continue</h2>
    <div>
      <div className="field"><label>Email</label><input type="email" id="loginEmail" placeholder="you@aciersteel.com"/></div>
      <div className="field"><label>Password</label><input type="password" id="loginPass" placeholder="••••••••"/></div>
      <div className="login-err" id="loginErr"></div>
   </div>
  </div>
</div>
    )
}