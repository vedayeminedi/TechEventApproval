import { supabase } from './supabase.js';
import './style.css';

const app = document.querySelector('#app');

let currentUser = null;

function showMessage(message) {
  alert(message);
}

function showAuth() {
  app.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <h1>EventPass</h1>
        <p>Technical Event Approval Portal</p>

        <div class="auth-tabs">
          <button id="loginTab">Login</button>
          <button id="signupTab">Sign Up</button>
        </div>

        <form id="authForm">
          <label id="nameLabel" hidden>
            Full Name
            <input name="fullName" placeholder="Enter your full name">
          </label>

          <label>
            Email
            <input name="email" type="email" required
              placeholder="Enter your email">
          </label>

          <label>
            Password
            <input name="password" type="password" required
              minlength="6" placeholder="Enter your password">
          </label>

          <button type="submit" id="authSubmit">Login</button>
        </form>

        <p id="authMessage"></p>
      </div>
    </div>
  `;

  let mode = 'login';

  const form = document.querySelector('#authForm');
  const nameLabel = document.querySelector('#nameLabel');
  const fullNameInput = form.elements.fullName;
  const submitButton = document.querySelector('#authSubmit');
  const message = document.querySelector('#authMessage');

  function setMode(nextMode) {
    mode = nextMode;
    const signup = mode === 'signup';

    nameLabel.hidden = !signup;
    fullNameInput.required = signup;
    submitButton.textContent = signup ? 'Create Account' : 'Login';
    message.textContent = '';
  }

  document.querySelector('#loginTab').addEventListener('click', () => {
    setMode('login');
  });

  document.querySelector('#signupTab').addEventListener('click', () => {
    setMode('signup');
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    submitButton.disabled = true;
    message.textContent = 'Please wait...';

    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    const fullName = fullNameInput.value.trim();

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName
            }
          }
        });

        if (error) throw error;

        if (!data.session) {
          message.textContent =
            'Account created. Check your email to confirm it, then log in.';
          return;
        }

        currentUser = data.user;
        await ensureProfile(currentUser, fullName);
        await showDashboard();
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;

        currentUser = data.user;
        await ensureProfile(currentUser);
        await showDashboard();
      }
    } catch (error) {
      message.textContent = error.message;
    } finally {
      submitButton.disabled = false;
    }
  });
}

async function ensureProfile(user, suppliedName = '') {
  const { data: profile, error: readError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (readError) {
    throw new Error(
      'Could not check your student profile: ' + readError.message
    );
  }

  if (!profile) {
    const fullName =
      suppliedName ||
      user.user_metadata?.full_name ||
      user.email?.split('@')[0] ||
      'Student';

    const { error } = await supabase.from('profiles').insert({
      id: user.id,
      full_name: fullName,
      role: 'student'
    });

    if (error) {
      throw new Error(
        'Account exists, but profile setup failed: ' + error.message
      );
    }
  }
}

async function showDashboard() {
  app.innerHTML = `
    <div class="app">
      <aside class="sidebar">
        <h2>EventPass</h2>
        <p>EVENT MANAGEMENT</p>

        <nav>
          <a class="active" href="#">Dashboard</a>
          <a href="#requests">My Requests</a>
          <a href="#attendance">Attendance</a>
          <a href="#" id="sidebarNewRequest">Submit Request</a>
        </nav>

        <div class="sidebar-bottom">
          <span>Technical Event Portal</span>
          <button id="logoutButton" class="secondary">Logout</button>
        </div>
      </aside>

      <main class="main">
        <header class="topbar">
          <div>
            <p class="eyebrow">STUDENT PORTAL</p>
            <h1>Dashboard</h1>
            <p class="muted">Manage your technical event participation.</p>
            <p id="studentEmail" class="muted"></p>
          </div>
          <div class="avatar">S</div>
        </header>

        <section class="welcome">
          <div>
            <p>WELCOME TO EVENTPASS</p>
            <h2>Your next opportunity starts here.</h2>
            <span>Track attendance, request event permission and monitor approvals.</span>
          </div>
          <button id="newRequest">+ New Request</button>
        </section>

        <section class="stats">
          <article class="stat-card">
            <span>Attendance</span>
            <h2>--</h2>
            <small>Attendance data not loaded</small>
          </article>

          <article class="stat-card">
            <span>Eligibility</span>
            <h2>--</h2>
            <small>Based on attendance records</small>
          </article>

          <article class="stat-card">
            <span>Total Requests</span>
            <h2 id="totalRequests">0</h2>
            <small>Saved requests</small>
          </article>

          <article class="stat-card">
            <span>Pending Requests</span>
            <h2 id="pendingRequests">0</h2>
            <small>Awaiting review</small>
          </article>
        </section>

        <section class="panel" id="requests">
          <div class="panel-heading">
            <div>
              <h2>Recent Requests</h2>
              <p class="muted">Track the status of your applications.</p>
            </div>
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>REFERENCE</th>
                  <th>EVENT</th>
                  <th>DATE</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody id="requestRows"></tbody>
            </table>
          </div>
        </section>

        <footer>EventPass · Technical Event Approval Portal</footer>
      </main>
    </div>

    <dialog id="requestDialog">
      <form id="requestForm">
        <h2>Submit an Event Request</h2>

        <label>
          Event title
          <input name="title" required placeholder="e.g. AI Hackathon">
        </label>

        <label>
          Organizer
          <input name="organizer" required placeholder="Organization name">
        </label>

        <label>
          Start date
          <input name="date" type="date" required>
        </label>

        <label>
          Venue
          <input name="venue" required placeholder="Event location">
        </label>

        <label>
          Reason for participation
          <textarea name="reason" required
            placeholder="Why do you want to attend?"></textarea>
        </label>

        <div class="dialog-actions">
          <button type="button" id="cancelRequest" class="secondary">
            Cancel
          </button>
          <button type="submit">Submit Request</button>
        </div>
      </form>
    </dialog>
  `;

  document.querySelector('#studentEmail').textContent = currentUser.email;

  const dialog = document.querySelector('#requestDialog');
  const form = document.querySelector('#requestForm');
  const rows = document.querySelector('#requestRows');

  document.querySelector('#newRequest').addEventListener('click', () => {
    dialog.showModal();
  });

  document.querySelector('#sidebarNewRequest').addEventListener('click', (event) => {
    event.preventDefault();
    dialog.showModal();
  });

  document.querySelector('#cancelRequest').addEventListener('click', () => {
    dialog.close();
  });

  document.querySelector('#logoutButton').addEventListener('click', async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      showMessage(error.message);
      return;
    }

    currentUser = null;
    showAuth();
  });

  function addRequestRow(request) {
    const row = document.createElement('tr');

    [
      String(request.id),
      request.event_title,
      request.event_date,
      request.status
    ].forEach((value, index) => {
      const cell = document.createElement('td');

      if (index === 3) {
        const badge = document.createElement('span');
        badge.className =
          request.status === 'approved' ? 'badge approved' : 'badge pending';

        badge.textContent =
          request.status === 'approved'
            ? 'Approved'
            : request.status === 'rejected'
              ? 'Rejected'
              : request.status.replaceAll('_', ' ');

        cell.appendChild(badge);
      } else {
        cell.textContent = value ?? '';
      }

      row.appendChild(cell);
    });

    rows.appendChild(row);
  }

  async function loadRequests() {
    const { data, error } = await supabase
      .from('event_requests')
      .select('id, event_title, event_date, status, created_at')
      .eq('student_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Could not load requests:', error.message);
      showMessage('Could not load requests: ' + error.message);
      return;
    }

    rows.innerHTML = '';
    data.forEach(addRequestRow);

    document.querySelector('#totalRequests').textContent = data.length;
    document.querySelector('#pendingRequests').textContent =
      data.filter(request =>
        ['pending', 'proctor_approved'].includes(request.status)
      ).length;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Saving...';

    try {
      const formData = new FormData(form);

      const { data, error } = await supabase
        .from('event_requests')
        .insert({
          student_id: currentUser.id,
          event_title: formData.get('title'),
          organizer: formData.get('organizer'),
          event_date: formData.get('date'),
          venue: formData.get('venue'),
          reason: formData.get('reason'),
          status: 'pending'
        })
        .select('id, event_title, event_date, status, created_at')
        .single();

      if (error) throw error;

      rows.prepend(createRequestRow(data));

      const { count, error: countError } = await supabase
        .from('event_requests')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', currentUser.id);

      if (!countError) {
        document.querySelector('#totalRequests').textContent = count;
      }

      await loadRequests();
      dialog.close();
      form.reset();
      showMessage('Your request was saved successfully!');
    } catch (error) {
      console.error('Request submission failed:', error);
      showMessage('Could not save request: ' + error.message);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Submit Request';
    }
  });

  function createRequestRow(request) {
    const row = document.createElement('tr');

    [
      String(request.id),
      request.event_title,
      request.event_date,
      request.status
    ].forEach((value, index) => {
      const cell = document.createElement('td');

      if (index === 3) {
        const badge = document.createElement('span');
        badge.className =
          request.status === 'approved' ? 'badge approved' : 'badge pending';
        badge.textContent = request.status.replaceAll('_', ' ');
        cell.appendChild(badge);
      } else {
        cell.textContent = value ?? '';
      }

      row.appendChild(cell);
    });

    return row;
  }

  await loadRequests();
}

async function startApp() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.error('Could not check session:', error.message);
    showAuth();
    return;
  }

  if (data.session?.user) {
    currentUser = data.session.user;

    try {
      await ensureProfile(currentUser);
      await showDashboard();
    } catch (error) {
      console.error(error);
      showMessage(error.message);
      showAuth();
    }
  } else {
    showAuth();
  }
}

startApp();