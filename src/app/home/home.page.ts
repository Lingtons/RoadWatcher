import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { Camera, PictureSourceType, CameraOptions } from '@ionic-native/camera/ngx';
import { HttpClient } from '@angular/common/http';
import { ActionSheetController, ToastController, Platform, LoadingController } from '@ionic/angular';
import { WebView } from '@ionic-native/ionic-webview/ngx';
import { File, FileEntry } from '@ionic-native/file/ngx';
import { Storage } from '@ionic/storage';
import { FilePath } from '@ionic-native/file-path/ngx';
import { AndroidPermissions } from '@ionic-native/android-permissions/ngx';
import { Geolocation } from '@ionic-native/geolocation/ngx';
import { LocationAccuracy } from '@ionic-native/location-accuracy/ngx';
import { finalize } from 'rxjs/operators';

const STORAGE_KEY = 'my_images';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit {
    images = [];
    locationCoords: any;
    timetest: any;

    constructor(private camera: Camera, private file: File, private http: HttpClient, private webView: WebView,
        private actionSheetController: ActionSheetController, private toastController: ToastController,
        private storage: Storage, private plt: Platform, private loadingController: LoadingController,
        private ref: ChangeDetectorRef, private filePath: FilePath, private androidPermissions: AndroidPermissions,
        private geolocation: Geolocation,
        private locationAccuracy: LocationAccuracy) {

        this.locationCoords = {
            latitude: "",
            longitude: "",
            accuracy: "",
            timestamp: ""
        }
        this.timetest = Date.now();
    }

    ngOnInit() {
        this.plt.ready().then(() => {
            this.loadStoredImages();
            this.requestGPSPermission();
        });
    }

    //Check if application having GPS access permission  
    checkGPSPermission() {
        this.androidPermissions.checkPermission(this.androidPermissions.PERMISSION.ACCESS_COARSE_LOCATION).then(
            result => {
                if (result.hasPermission) {

                    //If having permission show 'Turn On GPS' dialogue
                    this.askToTurnOnGPS();
                } else {

                    //If not having permission ask for permission
                    this.requestGPSPermission();
                }
            },
            err => {
                alert(err);
            }
        );
    }

    requestGPSPermission() {
        this.locationAccuracy.canRequest().then((canRequest: boolean) => {
            if (canRequest) {
                console.log("4");
            } else {
                //Show 'GPS Permission Request' dialogue
                this.androidPermissions.requestPermission(this.androidPermissions.PERMISSION.ACCESS_COARSE_LOCATION)
                    .then(
                        () => {
                            // call method to turn on GPS
                            this.askToTurnOnGPS();
                        },
                        error => {
                            //Show alert if user click on 'No Thanks'
                            alert('requestPermission Error requesting location permissions ' + error)
                        }
                    );
            }
        });
    }

    askToTurnOnGPS() {
        this.locationAccuracy.request(this.locationAccuracy.REQUEST_PRIORITY_HIGH_ACCURACY).then(
            () => {
                // When GPS Turned ON call method to get Accurate location coordinates
                this.getLocationCoordinates()
            },
            error => alert('Error requesting location permissions ' + JSON.stringify(error))
        );
    }

    // Methos to get device accurate coordinates using device GPS
    getLocationCoordinates() {
        this.geolocation.getCurrentPosition().then((resp) => {
            this.locationCoords.latitude = resp.coords.latitude;
            this.locationCoords.longitude = resp.coords.longitude;
            this.locationCoords.accuracy = resp.coords.accuracy;
            this.locationCoords.timestamp = resp.timestamp;
        }).catch((error) => {
            alert('Error getting location' + error);
        });
    }

    loadStoredImages() {
        this.storage.get(STORAGE_KEY).then(images => {
            if (images) {
                let arr = JSON.parse(images);
                this.images = [];
                for (let img of arr) {
                    let fPath = this.file.dataDirectory + img;
                    let resPath = this.pathForImage(fPath);
                    this.images.push({ name: img, path: resPath, filePath: fPath });
                }
            }
        });
    }

    pathForImage(img) {
        if (img === null) {
            return '';
        } else {
            let converted = this.webView.convertFileSrc(img);
            return converted;
        }
    }

    async presentToast(text) {
        const toast = await this.toastController.create({
            message: text,
            position: "bottom",
            duration:3000

        });
        toast.present();
    }

    async selectImage() {
        const actionSheet = await this.actionSheetController.create({
            header: "Select Image Source",
            buttons: [
                {
                    text: 'Load from Library',
                    handler: () => {
                        this.takePicture(this.camera.PictureSourceType.PHOTOLIBRARY);
                    }
                },
                {
                    text: 'Use Camera',
                    handler: () => {
                        this.takePicture(this.camera.PictureSourceType.CAMERA);
                    }
                },
                {
                    text: 'Cancel',
                    role: 'cancel'
                }
            ]
        });
        await actionSheet.present();
    }

    takePicture(sourceType: PictureSourceType) {
        var options: CameraOptions = {
            quality: 100,
            sourceType: sourceType,
            saveToPhotoAlbum: false,
            correctOrientation: true
        };

        this.camera.getPicture(options).then(imagePath => {
            if (this.plt.is('android') && sourceType === this.camera.PictureSourceType.PHOTOLIBRARY) {
                this.filePath.resolveNativePath(imagePath)
                    .then(filePath => {
                        let correctPath = filePath.substr(0, filePath.lastIndexOf('/') + 1);
                        let currentName = imagePath.substring(imagePath.lastIndexOf('/') + 1, imagePath.lastIndexOf('?'));
                        this.copyFileToLocalDir(correctPath, currentName, this.createFileName());
                    });
            } else {
                var currentName = imagePath.substr(imagePath.lastIndexOf('/') + 1);
                var correctPath = imagePath.substr(0, imagePath.lastIndexOf('/') + 1);
                this.copyFileToLocalDir(correctPath, currentName, this.createFileName());
            }

            //var currentName = imagePath.substr(imagePath.lastIndexOf('/') + 1);
            //var correctPath = imagePath.substr(0, imagePath.lastIndexOf('/') + 1);
            //this.copyFileToLocalDir(correctPath, currentName, this.createFileName())
        })
    }

    copyFileToLocalDir(namePath, currentName, newFileName) {
        this.file.copyFile(namePath, currentName, this.file.dataDirectory, newFileName).then(success => {
            this.updateStoredImages(newFileName);
        }, error => {
            this.presentToast('Error while storing file.');
        });
    }

    updateStoredImages(name) {
        this.storage.get(STORAGE_KEY).then(images => {
            let arr = JSON.parse(images);
            if (!arr) {
                let newImages = [name];
                this.storage.set(STORAGE_KEY, JSON.stringify(newImages));
            } else {
                arr.push(name);
                this.storage.set(STORAGE_KEY, JSON.stringify(arr));
            }

            let filePath = this.file.dataDirectory + name;
            let resPath = this.pathForImage(filePath);

            let newEntry = {
                name: name,
                path: resPath,
                filePath: filePath
            };

            this.images = [newEntry, ...this.images];
            this.ref.detectChanges(); // trigger change detection cycle
        })

    }

    createFileName() {
        var d = new Date(),
            n = d.getTime(),
            newFileName = n + ".jpg";
        return newFileName;
    }

    deleteImage(imgEntry, position) {
        this.images.splice(position, 1);
        this.storage.get(STORAGE_KEY).then(images => {
            let arr = JSON.parse(images);
            let filtered = arr.filter(name => name != imgEntry.name);
            this.storage.set(STORAGE_KEY, JSON.stringify(filtered));

            var correctPath = imgEntry.filePath.substr(0, imgEntry.filePath.lastIndexOf('/') + 1);
            this.file.removeFile(correctPath, imgEntry.name).then(res => {
                this.presentToast('File removed');
            });
        });
    }

    startUpload(imgEntry) {
        this.file.resolveLocalFilesystemUrl(imgEntry.filePath)
            .then((entry:any) => {
                (<FileEntry>entry).file(file => this.readFile(file))
                              
            })
            .catch(err => {
                this.presentToast('Error while reading file');
            })
    }

    readFile(file: any) {
        const reader = new FileReader();
        reader.onloadend = () => {
            const formData = new FormData();
            const imgBlob = new Blob([reader.result], {
                type: file.type
            });
            formData.append('file', imgBlob, file.name);
            this.uploadImageData(formData);
        };
        reader.readAsArrayBuffer(file);
    }

   async uploadImageData(formData: FormData) {
       const loading = await this.loadingController.create({
           message : 'Uploading image...'
       });
       await loading.present();

       this.http.post("http://localhost/upload.php", formData)
           .pipe(
               finalize(() => {
                   loading.dismiss();
               })
           )
           .subscribe(res => {
               if (res['success']) {
                   this.presentToast('File upload complete.')
               } else {
                   this.presentToast('File upload failed.')
               }
           }); 

    }


}
