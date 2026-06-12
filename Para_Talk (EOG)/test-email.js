const payload = {
    service_id: "service_t1r9h2k",
    template_id: "template_b2hu1hb",
    user_id: "KLgvyqra8AbpRU5cP",
    template_params: {
        to_email: "iitianadityakumarsingh@gmail.com",
        subject: "Test from Node",
        message: "Hello world"
    }
};

fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
})
.then(async (res) => {
    if (res.ok) {
        console.log("Success! Email sent.");
    } else {
        const text = await res.text();
        console.log("Failed:", res.status, text);
    }
})
.catch(err => console.error("Error:", err));
