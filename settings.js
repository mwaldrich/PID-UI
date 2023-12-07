/* Add an event listener to listen for the keyboard shortcut: ALT-S */

document.addEventListener('keyup', function(event) {
    if (event.key == '/' && event.ctrlKey) {
        console.log('Ctrl+/ pressed. Entering settings.')

        enterSettings()
        // document.getElementById('settings-popup').style.display = 'block'
    }
})

// If the user entered nothing for the unit number, delete the cookie.
function enterSettings() {
    const unitNumber = prompt("Please enter the unit #:")
    const experiment = confirm("Should we enable simulation?")


    const payload = {unitNumber: unitNumber, group: experiment? "experiment" : "control"}

    console.log(`Settings gathered: ${JSON.stringify(payload)}`)

    // this is confusing. But if the `unit` is NOT not a number, 
    // it is a number.
    if (unitNumber != "") {
        console.log(`Cookie set.`)
        document.cookie = `pidui-settings=${JSON.stringify(payload)}; path=/`
    } else {
        console.log(`Cookie deleted.`)
        document.cookie = `pidui-settings=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`
    }
}