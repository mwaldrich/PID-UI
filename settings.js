/* Add an event listener to listen for the keyboard shortcut: ALT-S */

document.addEventListener('keyup', function(event) {
    if (event.key == '/' && event.ctrlKey) {
        console.log('Ctrl+/ pressed. Entering settings.')

        enterSettings()
        // document.getElementById('settings-popup').style.display = 'block'
    }

    // if (event.key == "." && event.ctrlKey)
})

// If the user entered nothing for the unit number, delete the cookie.
function enterSettings() {
    const unitNumber = prompt("Please enter the unit #:")
    const experiment = confirm("Should we enable simulation on this machine?")


    const payload = {unitNumber: unitNumber, group: experiment? "experiment" : "control"}

    console.log(`Settings gathered: ${JSON.stringify(payload)}`)

    // this is confusing. But if the `unit` is NOT not a number, 
    // it is a number.
    if (unitNumber != "") {
        console.log(`Cookie set.`)
        Cookies.set('pidui-settings', JSON.stringify(payload))
    } else {
        console.log(`Cookie deleted.`)
        Cookies.remove('pidui-settings')
    }
}

// Retrieve device settings
function fetchSettings() {
    while (Cookies.get('pidui-settings') == undefined) {
        enterSettings()
    }
    return JSON.parse(Cookies.get('pidui-settings'))
}
