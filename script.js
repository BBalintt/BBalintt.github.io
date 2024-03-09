function sendEmail() {
    var name = document.getElementById("name").value;
    var jatszott = document.getElementById("jatszott").checked ? "Játszottam már" : "Nem játszottam még";
    var gameType = document.querySelector('input[name="j"]:checked') ? document.querySelector('input[name="j"]:checked').nextSibling.textContent : "Nincs kiválasztva";
    
    var emailBody = "Név: " + name + "%0A" +
                    "Játszott: " + jatszott + "%0A" +
                    "Játék típusa: " + gameType;
    var mailtoLink = 'mailto:'+document.getElementById("email").value+'?subject=Feedback&body=' + emailBody;
    window.location.href = mailtoLink;
}
function ena(){
    if(document.getElementById("jatszott").checked){
        for(var i=0;i<4;i++){
            document.getElementsByName("j")[i].disabled=false;
        }
    }
    else
    {
        for(var i=0;i<4;i++){
            document.getElementsByName("j")[i].disabled=true;
            document.getElementsByName("j")[i].checked=false;
        }
    }
}

function openModal() {
    document.getElementById("myModal").style.display = "block";
  }
  
  function closeModal() {
    document.getElementById("myModal").style.display = "none";
  }

  function openModal2() {
    document.getElementById("myModal2").style.display = "block";
  }
  
  function closeModal2() {
    document.getElementById("myModal2").style.display = "none";
  }
  var akad=false;
  function akadaly()
  {
    if(!akad)
    {
      document.body.style.color = "yellow";
      document.body.style.backgroundColor = "black";
      document.body.style.fontSize = "x-large";
      document.body.style.backgroundImage="none";
      akad=true;
    }
    else{
      document.body.style.color = "";
      document.body.style.color = "";
      document.body.style.fontSize = "";
      document.body.style.backgroundImage="bg.jpg";
      akad=false;
    }
  }